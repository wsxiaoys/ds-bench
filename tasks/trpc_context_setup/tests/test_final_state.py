import os
import socket
import pytest
import urllib.request
import json
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="module")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

@pytest.fixture(scope="module")
def start_app(xprocess, app_port):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            """
            Custom check: returns True if the target port is accepting connections.
            """
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

def test_get_user_with_header(start_app, app_port):
    url = f"http://localhost:{app_port}/api/trpc/getUser"
    req = urllib.request.Request(url, headers={"x-user-id": "123"})
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            assert "result" in data, f"Unexpected response format: {data}"
            assert "data" in data["result"], f"Unexpected response format: {data}"
            assert data["result"]["data"].get("userId") == "123", f"Expected userId to be '123', got: {data}"
    except urllib.error.HTTPError as e:
        pytest.fail(f"HTTP request failed with status {e.code}: {e.read().decode()}")
    except Exception as e:
        pytest.fail(f"Request failed: {e}")

def test_get_user_without_header(start_app, app_port):
    url = f"http://localhost:{app_port}/api/trpc/getUser"
    req = urllib.request.Request(url)
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            assert "result" in data, f"Unexpected response format: {data}"
            assert "data" in data["result"], f"Unexpected response format: {data}"
            assert data["result"]["data"].get("userId") == "anonymous", f"Expected userId to be 'anonymous', got: {data}"
    except urllib.error.HTTPError as e:
        pytest.fail(f"HTTP request failed with status {e.code}: {e.read().decode()}")
    except Exception as e:
        pytest.fail(f"Request failed: {e}")
