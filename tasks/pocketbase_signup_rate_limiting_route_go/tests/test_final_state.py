import pytest
import os
import socket
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/pb"

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

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

    pid, logpath = xprocess.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")

    yield

    # teardown: print the logs and terminate the service
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile when teardown =============================")
        print(logs)
        print("===== End: Captured xprocess logfile when teardown =============================")

    info = xprocess.getinfo(Starter.name)
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
