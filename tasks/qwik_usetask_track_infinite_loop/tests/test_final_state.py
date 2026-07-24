import os
import re
import socket

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/qwik-app"
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the readiness check, SSR fetch and
# browser agent all pointed at the same interface the dev server binds to.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the Qwik dev server (SSR) and wait until it serves HTTP."""

    class Starter(ProcessStarter):
        name = "qwik_dev"
        # Forward host/port to Vite so the SSR dev server binds the IPv4 loopback
        # on the fixed port the tests use.
        args = ["npm", "run", "dev", "--", "--host", HOST, "--port", str(PORT)]
        # CRITICAL: set `env` as a class attribute here, NEVER inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            # The very first SSR request triggers on-demand bundling, so allow a
            # generous timeout. A correct app must render without hanging.
            try:
                resp = requests.get(BASE_URL, timeout=30)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] {Starter.name} log =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} log =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _extract_testid_text(html: str, testid: str) -> str:
    """Return the trimmed text content of the first element with the given
    data-testid, with HTML comments (Qwik marker nodes) stripped."""
    match = re.search(
        r'data-testid="' + re.escape(testid) + r'"[^>]*>(.*?)</',
        html,
        re.DOTALL,
    )
    if not match:
        return ""
    inner = re.sub(r"<!--.*?-->", "", match.group(1))
    return inner.strip()


def test_ssr_total_rendered_on_server(start_app):
    """The initial order total must be computed and present in the server-rendered
    HTML (before any client JS runs), and the request must not hang."""
    resp = requests.get(BASE_URL, timeout=20)
    assert resp.status_code == 200, f"GET / returned status {resp.status_code}."
    html = resp.text
    assert 'data-testid="total"' in html, (
        "Server-rendered HTML does not contain an element with data-testid=\"total\"."
    )
    total_text = _extract_testid_text(html, "total")
    assert total_text == "$299.99", (
        "Server-rendered order total must be '$299.99' (server-side derivation), "
        f"but the HTML showed '{total_text}'. A client-only computation or a broken "
        "SSR task would not render the correct total in the initial HTML."
    )


def test_client_reactivity_and_coupon(start_app, browser_verifier):
    reason = (
        "A Qwik order-summary page derives an order total from line items and supports a "
        "toggleable 10% coupon. After the broken reactive wiring is fixed the page must "
        "resume on the client without freezing or console errors, and quantity/coupon "
        "changes must keep the total consistent."
    )
    truth = (
        f"Open {BASE_URL} and wait for it to load. The page must load quickly and stay "
        "responsive (it must not freeze or hang). "
        "The element with data-testid=\"total\" must show exactly \"$299.99\". "
        "The element with data-testid=\"qty-keyboard\" must show \"1\", data-testid=\"qty-mouse\" "
        "must show \"2\", and data-testid=\"qty-monitor\" must show \"1\". "
        "Click the button with data-testid=\"inc-keyboard\" one time: data-testid=\"qty-keyboard\" "
        "must then show \"2\" and data-testid=\"total\" must then show exactly \"$349.98\". "
        "Click the button with data-testid=\"dec-keyboard\" one time: data-testid=\"qty-keyboard\" "
        "must return to \"1\" and data-testid=\"total\" must return to exactly \"$299.99\". "
        "Then click (check) the checkbox with data-testid=\"coupon\": data-testid=\"total\" must "
        "change to exactly \"$269.99\". Click (uncheck) data-testid=\"coupon\" again: "
        "data-testid=\"total\" must return to exactly \"$299.99\". "
        "The verification passes only if every one of these observed values matches exactly."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_client_reactivity_and_coupon",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_auto_restock_starts_and_cleanup_stops(start_app, browser_verifier):
    reason = (
        "The page has an auto-restock feature that repeatedly increases the Mouse quantity "
        "while enabled and must stop immediately when disabled (correct task cleanup). A broken "
        "cleanup would keep incrementing the quantity after the feature is switched off."
    )
    truth = (
        f"Open {BASE_URL} and wait for it to load. The element with data-testid=\"qty-mouse\" "
        "must initially show \"2\". "
        "Click the button with data-testid=\"auto-toggle\" one time to enable auto-restock, then "
        "wait about 2 seconds. After waiting, the integer shown in data-testid=\"qty-mouse\" must "
        "be strictly greater than 2 (the quantity is increasing while enabled). "
        "Now click data-testid=\"auto-toggle\" one more time to disable auto-restock and immediately "
        "record the integer currently shown in data-testid=\"qty-mouse\" (call it N). "
        "Wait about 2 more seconds and read data-testid=\"qty-mouse\" again: it must still be exactly "
        "N (the quantity must NOT keep increasing after auto-restock is disabled). "
        "Also, with the coupon checkbox left unchecked, data-testid=\"total\" must equal "
        "\"$\" followed by ((4999 + 2550*N + 19900) divided by 100) formatted to exactly two decimals "
        "(for example if N is 5 the total is \"$377.49\"). "
        "The verification passes only if the quantity increased while enabled AND stopped changing "
        "after being disabled AND the final total matches the formula."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_auto_restock_starts_and_cleanup_stops",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
