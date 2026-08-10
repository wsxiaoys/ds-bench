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
        timeout = 240

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                # Check if the server responds on port 3000
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
        # Print logs if startup failed
        if os.path.exists(info.logpath):
            with open(info.logpath, "r") as f:
                print("--- APP LOGS ---")
                print(f.read())
        raise e
    yield
    info.terminate()

def test_task_verification(start_app, browser_verifier):
    reason = "File management system must correctly support folder structures, sharing links, and access logs."
    truth = (
        "Navigate to http://127.0.0.1:3000. Sign up with a username containing the run-id (read from /logs/artifacts/run-id) "
        "and a secure password. Log in, create a folder named with the run-id, navigate into it, and upload a file. "
        "Then generate a password-protected sharing link with an expiration time. Open an unauthenticated session, "
        "navigate to the sharing link, verify that the password prompt is shown, enter incorrect password to verify error, "
        "enter correct password to unlock, and download the file to verify the content matches. Finally, log back in as "
        "the registered user, navigate to the access logs page, and verify that the file access is correctly logged with "
        "the correct timestamp, IP, and User-Agent."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
