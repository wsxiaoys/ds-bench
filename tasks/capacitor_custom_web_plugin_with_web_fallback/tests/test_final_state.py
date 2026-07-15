import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/myproject"
DIST_DIR = os.path.join(PROJECT_DIR, "dist")
PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the static server and the browser
# on the same address so readiness checks do not hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


def _approx_equal(a, b, tol=1e-9):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


def _assert_stats(result, expected, label):
    assert isinstance(result, dict), f"{label}: analyze() should resolve to an object, got {result!r}"
    assert set(result.keys()) == set(expected.keys()), (
        f"{label}: expected exactly the keys {sorted(expected.keys())}, got {sorted(result.keys())}"
    )
    for key, want in expected.items():
        assert _approx_equal(result[key], want), (
            f"{label}: expected {key}={want}, got {result.get(key)!r}"
        )


def _poll_events(page, expected_len, timeout=8.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = page.evaluate("() => window.__analysisEvents.length")
        if last == expected_len:
            return
        time.sleep(0.2)
    raise AssertionError(
        f"Expected window.__analysisEvents to reach length {expected_len}, last observed {last}"
    )


@pytest.fixture(scope="session")
def serve_site(xprocess):
    # Build the project so a fresh dist/ exists before serving it.
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    print("=== npm run build stdout ===")
    print(build.stdout)
    print("=== npm run build stderr ===")
    print(build.stderr)
    assert build.returncode == 0, f"'npm run build' failed with code {build.returncode}"
    assert os.path.isfile(os.path.join(DIST_DIR, "index.html")), (
        f"Build did not produce {DIST_DIR}/index.html"
    )

    class Starter(ProcessStarter):
        name = "static_server"
        args = [
            "python3",
            "-m",
            "http.server",
            str(PORT),
            "--bind",
            HOST,
            "--directory",
            DIST_DIR,
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=10)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        try:
            with open(info.logpath) as f:
                print("=== static_server log ===")
                print(f.read())
        except OSError:
            pass
        assert started, "Static file server failed to start."

    yield BASE_URL

    info.terminate()


def test_custom_web_plugin_end_to_end(serve_site):
    base_url = serve_site
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        try:
            page.goto(base_url, wait_until="load")

            # Step 1: plugin registered on web, event sink present and empty.
            ready = page.evaluate(
                "() => typeof window.MetricsAnalyzer !== 'undefined' "
                "&& typeof window.MetricsAnalyzer.analyze === 'function' "
                "&& Array.isArray(window.__analysisEvents)"
            )
            assert ready, (
                "window.MetricsAnalyzer (with an analyze method) and window.__analysisEvents "
                "array must be exposed on the page."
            )
            assert page.evaluate("() => window.__analysisEvents.length") == 0, (
                "window.__analysisEvents should be empty on initial load."
            )

            # Step 2: statistics computation.
            r1 = page.evaluate(
                "async () => await window.MetricsAnalyzer.analyze({ values: [2,4,4,4,5,5,7,9] })"
            )
            _assert_stats(
                r1,
                {"count": 8, "sum": 40, "mean": 5, "min": 2, "max": 9, "stdDev": 2},
                "analyze([2,4,4,4,5,5,7,9])",
            )

            # Step 3: listener wired by the app receives the event.
            _poll_events(page, 1)
            ev1 = page.evaluate("() => window.__analysisEvents[window.__analysisEvents.length - 1]")
            assert set(ev1.keys()) == {"sequence", "mean"}, (
                f"Event payload must have exactly keys sequence and mean, got {sorted(ev1.keys())}"
            )
            assert ev1["sequence"] == 1 and _approx_equal(ev1["mean"], 5), (
                f"First analysisComplete event should be {{sequence:1, mean:5}}, got {ev1!r}"
            )
            event_count_text = page.inner_text("#event-count").strip()
            assert event_count_text == "1", (
                f"#event-count should display '1', got {event_count_text!r}"
            )
            result_text = page.inner_text("#result")
            assert "mean" in result_text and "5" in result_text, (
                f"#result should render the latest analysis JSON, got {result_text!r}"
            )

            # Step 4: running total.
            t1 = page.evaluate("async () => await window.MetricsAnalyzer.getRunningTotal()")
            assert isinstance(t1, dict) and t1.get("total") == 1, (
                f"getRunningTotal() should be {{total:1}}, got {t1!r}"
            )

            # Step 5: second analysis.
            r2 = page.evaluate(
                "async () => await window.MetricsAnalyzer.analyze({ values: [10, 20] })"
            )
            _assert_stats(
                r2,
                {"count": 2, "sum": 30, "mean": 15, "min": 10, "max": 20, "stdDev": 5},
                "analyze([10,20])",
            )
            _poll_events(page, 2)
            ev2 = page.evaluate("() => window.__analysisEvents[window.__analysisEvents.length - 1]")
            assert ev2.get("sequence") == 2 and _approx_equal(ev2.get("mean"), 15), (
                f"Second analysisComplete event should be {{sequence:2, mean:15}}, got {ev2!r}"
            )
            t2 = page.evaluate("async () => await window.MetricsAnalyzer.getRunningTotal()")
            assert t2.get("total") == 2, f"getRunningTotal() should be {{total:2}}, got {t2!r}"

            # Step 6: empty input.
            r3 = page.evaluate(
                "async () => await window.MetricsAnalyzer.analyze({ values: [] })"
            )
            _assert_stats(
                r3,
                {"count": 0, "sum": 0, "mean": 0, "min": 0, "max": 0, "stdDev": 0},
                "analyze([])",
            )
            _poll_events(page, 3)
            ev3 = page.evaluate("() => window.__analysisEvents[window.__analysisEvents.length - 1]")
            assert ev3.get("sequence") == 3 and _approx_equal(ev3.get("mean"), 0), (
                f"Third analysisComplete event should be {{sequence:3, mean:0}}, got {ev3!r}"
            )
            t3 = page.evaluate("async () => await window.MetricsAnalyzer.getRunningTotal()")
            assert t3.get("total") == 3, f"getRunningTotal() should be {{total:3}}, got {t3!r}"

            # Step 7: a dynamically added listener also receives events.
            page.evaluate(
                "async () => {"
                "  window.__extra = [];"
                "  const h = await window.MetricsAnalyzer.addListener("
                "    'analysisComplete', (e) => { window.__extra.push(e); });"
                "  return true;"
                "}"
            )
            page.evaluate(
                "async () => await window.MetricsAnalyzer.analyze({ values: [1, 2, 3] })"
            )
            deadline = time.time() + 8
            extra_last = None
            while time.time() < deadline:
                length = page.evaluate("() => (window.__extra || []).length")
                if length >= 1:
                    extra_last = page.evaluate(
                        "() => window.__extra[window.__extra.length - 1]"
                    )
                    break
                time.sleep(0.2)
            assert extra_last is not None, (
                "A dynamically added analysisComplete listener did not receive any event."
            )
            assert extra_last.get("sequence") == 4 and _approx_equal(extra_last.get("mean"), 2), (
                f"Dynamically added listener should receive {{sequence:4, mean:2}}, got {extra_last!r}"
            )

            assert not errors, f"Uncaught page errors during verification: {errors}"
        finally:
            browser.close()
