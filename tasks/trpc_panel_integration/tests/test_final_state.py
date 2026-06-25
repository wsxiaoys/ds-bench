import os
import subprocess
import socket
import json
import pytest
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"

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
    Starts the node service using xprocess. Confirms readiness via port check.
    """

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["node", "index.js", "--port", str(app_port)]
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

def test_trpc_endpoint(start_app, app_port):
    """Verify the tRPC endpoint works correctly."""
    result = subprocess.run(
        ["curl", "-s", f"http://localhost:{app_port}/trpc/greeting?input=%7B%22name%22%3A%22World%22%7D"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"curl failed: {result.stderr}"
    
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Expected JSON response, got: {result.stdout}")
        
    assert "result" in data, f"Expected 'result' in response, got: {data}"
    assert "data" in data["result"], f"Expected 'data' in result, got: {data['result']}"
    assert "World" in str(data["result"]["data"]), f"Expected 'World' in greeting, got: {data['result']['data']}"

def test_trpc_panel_html(start_app, app_port):
    """Verify the trpc-panel UI is served."""
    result = subprocess.run(
        ["curl", "-s", f"http://localhost:{app_port}/panel"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"curl failed: {result.stderr}"
    
    # trpc-panel returns an HTML page containing "tRPC Panel" or similar identifiers.
    # The exact string might vary, but it should be HTML and contain "trpc" or "panel".
    assert "<html" in result.stdout.lower() or "<!doctype html>" in result.stdout.lower(), \
        f"Expected HTML response, got: {result.stdout[:100]}..."
    assert "trpc" in result.stdout.lower(), \
        "Expected 'trpc' in the HTML response."
