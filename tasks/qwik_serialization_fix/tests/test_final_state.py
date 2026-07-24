import os
import shutil
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/keyword-tally"
DIST_DIR = os.path.join(PROJECT_DIR, "dist")
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the preview server would listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


@pytest.fixture(scope="session")
def build_app():
    """Build the production static site. This must succeed (it previously failed)."""
    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("============================== [BUILD stdout] ==============================")
    print(result.stdout)
    print("============================== [BUILD stderr] ==============================")
    print(result.stderr)
    assert result.returncode == 0, (
        "`npm run build` must exit 0 but it failed. The component must no longer "
        "capture non-serializable values across the `$` boundary. "
        f"stderr:\n{result.stderr}"
    )
    return result


def test_build_succeeds(build_app):
    """The production build must produce the static site artifacts."""
    index_html = os.path.join(DIST_DIR, "index.html")
    build_assets = os.path.join(DIST_DIR, "build")
    assert os.path.isfile(index_html), (
        f"Expected the built page {index_html} to exist after `npm run build`."
    )
    assert os.path.isdir(build_assets), (
        f"Expected the client JavaScript chunks directory {build_assets} to exist "
        "after `npm run build`."
    )


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess, build_app):
    """Start the production preview server on port 3000 for the built site."""

    class Starter(ProcessStarter):
        name = "keyword_tally_preview"
        args = ["npm", "run", "preview"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
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


def test_initial_render(start_app, browser_verifier):
    reason = (
        "The Keyword Tally page must render four keyword buttons and summary counters "
        "starting from a clean zero state, and it must activate a browser-only activity "
        "recorder once the page becomes active in the browser."
    )
    truth = (
        f"Navigate to {BASE_URL} and wait for the page to become interactive. "
        "Verify that the element with data-testid 'btn-alpha' has the exact text 'alpha: 0', "
        "the element with data-testid 'btn-beta' has the exact text 'beta: 0', "
        "the element with data-testid 'btn-gamma' has the exact text 'gamma: 0', and "
        "the element with data-testid 'btn-delta' has the exact text 'delta: 0'. "
        "Verify that the element with data-testid 'total' has the exact text 'Total: 0' and "
        "the element with data-testid 'touched' has the exact text 'Touched: 0'. "
        "Verify that shortly after the page loads, the element with data-testid "
        "'recorder-status' has the exact text 'recording' and the element with "
        "data-testid 'log-count' has the exact text 'Events: 0'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_initial_render",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_click_behavior(start_app, browser_verifier):
    reason = (
        "Clicking a keyword button must increment that keyword's tally by one and record "
        "exactly one event, and the Total, Touched, and Events counters must update "
        "reactively and correctly after every click."
    )
    truth = (
        f"Navigate to {BASE_URL} and wait until the element with data-testid "
        "'recorder-status' has the text 'recording'. "
        "Click the button with data-testid 'btn-alpha' 3 times. After these clicks, verify "
        "that 'btn-alpha' has the exact text 'alpha: 3', 'total' has the exact text "
        "'Total: 3', 'touched' has the exact text 'Touched: 1', and 'log-count' has the "
        "exact text 'Events: 3'. "
        "Next, click the button with data-testid 'btn-beta' 1 time and verify that "
        "'btn-beta' has the exact text 'beta: 1', 'total' has the exact text 'Total: 4', "
        "'touched' has the exact text 'Touched: 2', and 'log-count' has the exact text "
        "'Events: 4'. "
        "Next, click the button with data-testid 'btn-gamma' 2 times and verify that "
        "'btn-gamma' has the exact text 'gamma: 2', 'total' has the exact text 'Total: 6', "
        "'touched' has the exact text 'Touched: 3', and 'log-count' has the exact text "
        "'Events: 6'. "
        "Finally, verify that the button with data-testid 'btn-delta' still has the exact "
        "text 'delta: 0' because it was never clicked."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_click_behavior",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
