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
    class Starter(ProcessStarter):
        name = "start_app"
        # Force Wasp to bind to 127.0.0.1
        args = ["wasp", "start"]
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
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # Run db migration before starting the app
        subprocess.run(["wasp", "db", "migrate-dev", "--name", "init"], cwd=PROJECT_DIR, check=True)
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    except Exception as e:
        print(f"Startup failed: {e}")
        capture_logs("FAILED_STARTUP")
        raise e
    finally:
        if started:
            capture_logs("STARTED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()

def test_task_verification(start_app, browser_verifier):
    reason = (
        "The real-time notification center must allow users to receive notifications instantly via WebSockets "
        "when enabled, respect user preferences by not creating or delivering notifications when disabled, "
        "and support batch status updates (marking notifications as read/unread in batches)."
    )

    truth = (
        "Navigate to http://127.0.0.1:3000/signup. "
        "Sign up a new user with username 'testuser' and password 'password123'. "
        "Ensure redirection to the main page http://127.0.0.1:3000/ succeeds. "
        "Verify that the checkboxes for system ('pref-system'), security ('pref-security'), and activity ('pref-activity') notifications are all checked by default. "
        "In the Trigger Notification Form, select type 'SYSTEM', enter title 'System Maintenance' and message 'The server will reboot in 10 minutes.', then click the trigger button ('trigger-btn'). "
        "Verify that a new alert appears instantly in the real-time alerts list ('realtime-alerts' -> 'alert-item') containing the text 'System Maintenance' and 'The server will reboot in 10 minutes.' without reloading. "
        "Verify that the notification also appears in the stored notifications list ('notifications-list' -> 'notification-item') with status 'Unread'. "
        "Uncheck the System notifications preference checkbox ('pref-system') and click the save preferences button ('save-pref-btn'). "
        "In the Trigger Notification Form, select type 'SYSTEM', enter title 'Urgent Patch' and message 'This alert should be ignored.', then click the trigger button ('trigger-btn'). "
        "Verify that NO new alert appears in the real-time alerts list or the stored notifications list. "
        "In the Trigger Notification Form, select type 'SECURITY', enter title 'Login Alert' and message 'New login detected from local IP.', then click the trigger button ('trigger-btn'). "
        "Verify that the 'Login Alert' notification appears in the real-time list and stored list with status 'Unread'. "
        "Select the checkbox ('notification-checkbox') for both the 'System Maintenance' and 'Login Alert' notifications in the list, then click the mark read button ('mark-read-btn'). "
        "Verify that both notifications now display status 'Read' in the stored list."
    )

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
