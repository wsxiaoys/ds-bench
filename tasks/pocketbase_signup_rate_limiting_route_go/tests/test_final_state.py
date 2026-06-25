import pytest
import os
import socket
import requests
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/pb"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["go", "run", "main.go", "serve", f"--http=0.0.0.0:{app_port}"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0

    info = xprocess.getinfo(Starter.name)

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            logs = f.read()
            print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
            print(logs)
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

def test_rate_limited_signup(start_app, app_port):
    url = f"http://localhost:{app_port}/api/custom_signup"

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

def test_users_created(start_app, app_port):
    # Verify that the first 5 users were actually created by authenticating as them
    auth_url = f"http://localhost:{app_port}/api/collections/users/auth-with-password"

    for i in range(1, 6):
        payload = {
            "identity": f"test{i}@example.com",
            "password": "password12345"
        }
        response = requests.post(auth_url, json=payload)
        assert response.status_code == 200, f"Failed to authenticate as test{i}@example.com, user might not have been created properly: {response.text}"
