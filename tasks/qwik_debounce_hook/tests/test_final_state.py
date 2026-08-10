import os
import re
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/qwik-app"
HOOKS_FILE = os.path.join(PROJECT_DIR, "src", "hooks", "signals.ts")
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the readiness check and Playwright
# pointed at the same interface the dev server binds.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

REQUIRED_TESTIDS = [
    "debounce-input",
    "debounced-value",
    "previous-value",
    "throttle-input",
    "throttled-value",
    "interval-count",
    "toggle-timer",
]


# ---------------------------------------------------------------------------
# Non-runtime constraints: production build must compile, hooks module exports.
# ---------------------------------------------------------------------------


def test_build_succeeds():
    """`npm run build` must complete with no TS/optimizer/serialization errors."""
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert result.returncode == 0, (
        "`npm run build` failed (compile / optimizer / serialization error).\n"
        f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
    )


def test_hooks_module_exports_four_hooks():
    """The four hooks must be exported by exact name from src/hooks/signals.ts."""
    assert os.path.isfile(HOOKS_FILE), f"Hooks module not found at {HOOKS_FILE}."
    with open(HOOKS_FILE) as f:
        src = f.read()
    for name in ("useDebouncedSignal", "useThrottledSignal", "usePrevious", "useInterval"):
        pattern = re.compile(r"export\b[^\n]*\b" + re.escape(name) + r"\b")
        assert pattern.search(src), (
            f"Expected an exported `{name}` in {HOOKS_FILE}."
        )


# ---------------------------------------------------------------------------
# Live SSR dev server fixture.
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "qwik_app"
        args = ["npm", "run", "dev", "--", "--port", str(PORT), "--host", HOST]
        # Set env as a class attribute, never inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            # First request triggers on-demand SSR bundling; allow time for it.
            try:
                resp = requests.get(BASE_URL, timeout=30)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            return
        new = lines[printed:]
        skipped = printed
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log (skipped {skipped} lines) =====")
        print("".join(new))
        print(f"===== [{tag}] end log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


# ---------------------------------------------------------------------------
# SSR safety (server render must not crash and must contain all testids).
# ---------------------------------------------------------------------------


def test_ssr_renders_index(start_app):
    resp = requests.get(BASE_URL, timeout=30)
    assert resp.status_code == 200, (
        f"SSR of / returned {resp.status_code}; the server render likely crashed "
        "(e.g. a hook touched a browser-only global during SSR)."
    )
    body = resp.text
    for tid in REQUIRED_TESTIDS:
        assert f'data-testid="{tid}"' in body, (
            f'Server-rendered HTML is missing data-testid="{tid}".'
        )


# ---------------------------------------------------------------------------
# Client-side timing behavior (Playwright, deterministic control).
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def page(start_app):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        pg = browser.new_page()
        yield pg
        browser.close()


def _sel(tid):
    return f'[data-testid="{tid}"]'


def _text(page, tid):
    return (page.text_content(_sel(tid)) or "").strip()


def _int(page, tid):
    txt = _text(page, tid)
    assert re.fullmatch(r"-?\d+", txt), f"{tid} is not an integer, got {txt!r}."
    return int(txt)


def _load(page):
    page.goto(BASE_URL, wait_until="networkidle")
    # Give Qwik a moment to resume on the client.
    page.wait_for_timeout(500)


def test_initial_client_state(page):
    _load(page)
    assert _text(page, "debounced-value") == "", "debounced-value should start empty."
    assert _text(page, "throttled-value") == "", "throttled-value should start empty."
    assert _text(page, "previous-value") == "", "previous-value should start empty."
    assert _int(page, "interval-count") == 0, "interval-count should start at 0."


def test_debounce_coalescing_and_previous(page):
    _load(page)

    # Rapid burst of changes, ~80ms apart, all well within the 500ms delay.
    page.fill(_sel("debounce-input"), "a")
    page.wait_for_timeout(80)
    page.fill(_sel("debounce-input"), "ab")
    page.wait_for_timeout(80)
    page.fill(_sel("debounce-input"), "abc")

    # Still within the debounce window: no update should have been applied,
    # and no intermediate value ("a"/"ab") should ever have appeared.
    assert _text(page, "debounced-value") == "", (
        "debounced-value updated before the 500ms delay elapsed (not coalescing)."
    )

    # After the window settles, the final coalesced value appears.
    page.wait_for_timeout(800)
    assert _text(page, "debounced-value") == "abc", (
        "debounced-value did not settle to the final value 'abc'."
    )
    # previous() of the debounced signal holds the value before the first change.
    assert _text(page, "previous-value") == "", (
        "previous-value should be empty (the value before the first debounced change)."
    )

    # Second settled change: previous must now track the prior debounced value.
    page.fill(_sel("debounce-input"), "xyz")
    page.wait_for_timeout(800)
    assert _text(page, "debounced-value") == "xyz", (
        "debounced-value did not settle to 'xyz' on the second change."
    )
    assert _text(page, "previous-value") == "abc", (
        "previous-value should be 'abc' (the debounced value before it became 'xyz')."
    )


def test_throttle_leading_and_trailing(page):
    _load(page)

    # Leading edge: first change after idle applies immediately.
    page.fill(_sel("throttle-input"), "A")
    page.wait_for_timeout(120)
    assert _text(page, "throttled-value") == "A", (
        "throttled-value did not apply the first change immediately (leading edge)."
    )

    # Further changes within the same 500ms window are not applied immediately.
    page.fill(_sel("throttle-input"), "AB")
    page.wait_for_timeout(60)
    page.fill(_sel("throttle-input"), "ABC")
    page.wait_for_timeout(120)  # ~300ms since leading edge
    assert _text(page, "throttled-value") == "A", (
        "throttled-value changed mid-window; throttling did not rate-limit updates."
    )

    # After the window elapses, the most recent value is applied (trailing edge).
    page.wait_for_timeout(500)  # ~800ms since leading edge
    assert _text(page, "throttled-value") == "ABC", (
        "throttled-value did not apply the latest value on the trailing edge."
    )


def test_interval_start_stop_resume(page):
    _load(page)
    assert _int(page, "interval-count") == 0, "interval-count should start at 0."

    # Enable: counter must advance (200ms tick).
    page.click(_sel("toggle-timer"))
    page.wait_for_timeout(900)
    first = _int(page, "interval-count")
    assert first >= 3, f"interval-count should have advanced to >=3 while enabled, got {first}."
    second = _int(page, "interval-count")
    assert second >= first, "interval-count must be non-decreasing while enabled."

    # Disable: counter must freeze (no leaked timer).
    page.click(_sel("toggle-timer"))
    page.wait_for_timeout(150)  # let any in-flight tick and cleanup settle
    frozen = _int(page, "interval-count")
    page.wait_for_timeout(700)
    assert _int(page, "interval-count") == frozen, (
        f"interval-count changed after disabling (leaked timer); was {frozen}."
    )

    # Re-enable: counter must resume advancing.
    page.click(_sel("toggle-timer"))
    page.wait_for_timeout(900)
    assert _int(page, "interval-count") > frozen, (
        "interval-count did not resume advancing after re-enabling."
    )
