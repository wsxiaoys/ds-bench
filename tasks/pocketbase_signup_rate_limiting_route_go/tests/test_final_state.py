import pytest
import os
import socket
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/pb"

@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["go", "run", "main.go", "serve", "--http=0.0.0.0:8090"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 8090)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0  # track how many lines have already been printed

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
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield
    capture_logs("TEARDOWN")
    info.terminate()

def test_rate_limited_signup(start_app):
    url = "http://127.0.0.1:8090/api/custom_signup"

    # 1. First 5 Requests (Success)
    for i in range(1, 6):
        payload = {
            "email": f"test{i}@example.com",
            "password": "password12345",
            "passwordConfirm": "password12345"
        }
        response = requests.post(url, json=payload)
        assert response.status_code in (200, 201), f"Request {i} failed with status {response.status_code}: {response.text}"

    # 2. 6th Request (Rate Limited)
    payload = {
        "email": "test6@example.com",
        "password": "password12345",
        "passwordConfirm": "password12345"
    }
    response = requests.post(url, json=payload)
    assert response.status_code == 429, f"Expected status 429 for 6th request, got {response.status_code}: {response.text}"

def test_users_created(start_app):
    # Verify that the first 5 users were actually created by authenticating as them
    auth_url = "http://127.0.0.1:8090/api/collections/users/auth-with-password"

    for i in range(1, 6):
        payload = {
            "identity": f"test{i}@example.com",
            "password": "password12345"
        }
        response = requests.post(auth_url, json=payload)
        assert response.status_code == 200, f"Failed to authenticate as test{i}@example.com, user might not have been created properly: {response.text}"
