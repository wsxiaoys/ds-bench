import pytest
import subprocess
import os
import socket
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/app"
PORT = 3000
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """Starts the Wasp application using xprocess. Confirms readiness via port check."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            """Returns True if the Wasp server is accepting connections on port 3000."""
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
        if not os.path.exists(info.logpath):
            return
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # Run db migrations before starting
        subprocess.run(["wasp", "db", "migrate-dev", "--name", "init"], cwd=PROJECT_DIR, check=True)
        # Ensure starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()

def test_task_verification(start_app, browser_verifier):
    reason = "Multiple users must be able to edit the document concurrently and see changes in real-time."
    truth = (
        "1. Open Session 1 and navigate to http://127.0.0.1:3000/signup. Register a user with username 'alice' and password 'password123'.\n"
        "2. Open Session 2 and navigate to http://127.0.0.1:3000/signup. Register a user with username 'bob' and password 'password123'.\n"
        "3. In Session 1, log in as 'alice' with password 'password123' if not logged in. You should be redirected to the homepage '/'.\n"
        "4. In Session 2, log in as 'bob' with password 'password123' if not logged in. You should be redirected to the homepage '/'.\n"
        "5. In Session 1, create a document titled 'Shared Notes' using the creation form (input id='document-title-input' and button id='create-document-btn' or text 'Create Document').\n"
        "6. In Session 1, click on the newly created document link to navigate to '/document/1'.\n"
        "7. In Session 1, share the document with 'bob' giving him 'EDIT' permission using the share form (input id='share-username-input', select id='share-role-select' set to 'EDIT', and button id='share-document-btn' or text 'Share').\n"
        "8. In Session 2, navigate to the homepage '/', verify that 'Shared Notes' is listed under shared documents, and click the link to navigate to '/document/1'.\n"
        "9. In Session 1, type 'Hello from Alice!' in the textarea with id='document-content-textarea'.\n"
        "10. In Session 2, verify that the content of the textarea with id='document-content-textarea' updates to 'Hello from Alice!' in real-time.\n"
        "11. In Session 2, append ' and Bob!' to the content (so it becomes 'Hello from Alice! and Bob!') and click the button with id='save-version-btn' or text 'Save Version'.\n"
        "12. Verify that in Session 1, the textarea updates to 'Hello from Alice! and Bob!', and both sessions see a new version in the version list under id='version-history-list' with author 'bob'.\n"
        "13. In Session 1, click the 'Restore' button or class='restore-version-btn' next to the first version (which should have content 'Hello from Alice!').\n"
        "14. Verify that the textarea content in both Session 1 and Session 2 updates to 'Hello from Alice!' in real-time.\n"
        "15. Open Session 3, navigate to http://127.0.0.1:3000/signup, and register a user with username 'charlie' and password 'password123'.\n"
        "16. In Session 1, share the document with 'charlie' giving him 'VIEW' permission.\n"
        "17. In Session 3, log in as 'charlie' and navigate to http://127.0.0.1:3000/document/1.\n"
        "18. Verify that the textarea with id='document-content-textarea' is disabled or read-only (has the 'disabled' or 'readOnly' attribute), and the 'Save Version' and 'Restore' buttons are not visible or are disabled."
    )

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
