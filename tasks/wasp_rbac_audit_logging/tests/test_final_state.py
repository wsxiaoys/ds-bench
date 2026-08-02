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
        args = ["wasp", "start"]
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
    try:
        # Run db migration before starting the app
        subprocess.run(["wasp", "db", "migrate-dev", "--name", "init"], cwd=PROJECT_DIR, check=True)
        xprocess.ensure(Starter.name, Starter)
    except Exception as e:
        print(f"Startup failed: {e}")
        # Print logs if available
        if os.path.exists(info.logpath):
            with open(info.logpath, "r") as f:
                print("--- APP LOGS ---")
                print(f.read())
        raise e
    yield
    info.terminate()

def test_task_verification(start_app, browser_verifier):
    reason = "Role-based access control and audit logging must be correctly implemented and verified."
    truth = (
        "Navigate to http://127.0.0.1:3000.\n"
        "1. Verify Admin Signup Rejection (Auth Hook):\n"
        "   - Go to /signup, register username 'bad_admin', password 'password123', and role 'ADMIN'.\n"
        "   - Expected: Signup fails/is rejected with an error message because username does not end in '_admin'.\n"
        "2. Verify Analyst Registration and Access:\n"
        "   - Go to /signup, register username 'analyst_user', password 'password123', and role 'ANALYST'.\n"
        "   - Log in as 'analyst_user'.\n"
        "   - Expected: Dashboard shows 'Role: ANALYST', Document Creation Form is not visible/disabled, and no Update/Delete buttons or Audit Logs are visible.\n"
        "3. Verify Manager Registration, Document Creation, and Update:\n"
        "   - Log out of 'analyst_user'.\n"
        "   - Register username 'manager_user', password 'password123', and role 'MANAGER'. Log in.\n"
        "   - Expected: Dashboard shows 'Role: MANAGER' and Document Creation Form is visible.\n"
        "   - Create a document with Title 'Manager Doc' and Content 'Manager Content'.\n"
        "   - Expected: Document appears in the list. Update button is visible, but Delete button and Audit Logs are not visible.\n"
        "   - Click the Update button.\n"
        "   - Expected: Document title updates to 'Manager Doc (updated)' and content to 'Manager Content (updated)'.\n"
        "4. Verify Admin Registration, Audit Logs, and Document Deletion:\n"
        "   - Log out of 'manager_user'.\n"
        "   - Register username 'super_admin', password 'password123', and role 'ADMIN'. Log in.\n"
        "   - Expected: Dashboard shows 'Role: ADMIN' and both Update and Delete buttons are visible.\n"
        "   - Expected: Audit Logs section is visible and displays at least two logs (one CREATE and one UPDATE action for Document performed by manager_user).\n"
        "   - Click the Delete button.\n"
        "   - Expected: Document is removed from the list.\n"
        "   - Expected: A third audit log entry is added with action: 'DELETE' and entityName: 'Document' for the deleted document."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
