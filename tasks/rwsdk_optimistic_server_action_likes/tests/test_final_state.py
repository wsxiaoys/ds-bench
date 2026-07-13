import os
import socket

import pytest
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK dev server via xprocess and wait for the port."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_like_button_increments_and_rerenders(start_app, browser_verifier):
    reason = (
        "The home page must expose a persistent 'Like' feature built with a RedwoodSDK "
        "serverAction. The current like count is shown in an element carrying "
        "data-testid=\"like-count\", and a control carrying data-testid=\"like-button\" "
        "triggers a server action that increments the persisted count by exactly one and "
        "re-renders the page so the visible count updates without a manual reload."
    )
    truth = (
        "Navigate to http://127.0.0.1:5173/. "
        "Find the element with attribute data-testid=\"like-count\" and read its trimmed "
        "text content; it must be a non-negative integer. Call this baseline value B. "
        "Confirm that an element with attribute data-testid=\"like-button\" exists. "
        "Click the data-testid=\"like-button\" element once and wait for the page to update. "
        "Verify that the data-testid=\"like-count\" element's text becomes exactly B + 1 "
        "without you manually reloading the page. "
        "Click the data-testid=\"like-button\" element two more times, waiting for the page "
        "to update after each click. Verify the data-testid=\"like-count\" element's text "
        "becomes exactly B + 3."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_like_button_increments_and_rerenders",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_like_count_persists_across_reload(start_app, browser_verifier):
    reason = (
        "The like count must be persisted in a Cloudflare D1 database (via Drizzle) and "
        "read back from that database when the page is rendered, so the value is retained "
        "across full page reloads rather than being held only in memory."
    )
    truth = (
        "Navigate to http://127.0.0.1:5173/. "
        "Find the element with attribute data-testid=\"like-count\" and read its trimmed "
        "text content as an integer; call this value C. "
        "Click the element with attribute data-testid=\"like-button\" once and wait for the "
        "page to update; the data-testid=\"like-count\" text must become exactly C + 1. "
        "Now reload the page (perform a fresh navigation to http://127.0.0.1:5173/). "
        "After the reload, read the data-testid=\"like-count\" text again and verify it is "
        "still exactly C + 1, proving the incremented value was persisted to the database "
        "and read back on render."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_like_count_persists_across_reload",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
