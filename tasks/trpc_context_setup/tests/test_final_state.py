import os
import socket
import pytest
import urllib.request
import json
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="module")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

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
