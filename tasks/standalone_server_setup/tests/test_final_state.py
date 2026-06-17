import os
import subprocess
import time
import socket
import pytest
import urllib.request
import urllib.error
import json

PROJECT_DIR = "/home/user/project"

def wait_for_port(port, timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('localhost', port)) == 0:
                return True
        time.sleep(1)
    return False

@pytest.fixture(scope="module")
def start_app():
    # Check if directory exists
    if not os.path.isdir(PROJECT_DIR):
        pytest.fail(f"Project directory {PROJECT_DIR} does not exist.")

    # Start the app
    process = subprocess.Popen(
        ["npx", "ts-node", "server.ts"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    # Wait for the app to be ready
    if not wait_for_port(3000):
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on port 3000.")

    yield

    # Shut down the app
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_greet_procedure(start_app):
    url = 'http://localhost:3000/greet?input=%7B%22name%22%3A%22World%22%7D'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            assert response.status == 200, f"Expected status 200, got {response.status}"
            data = json.loads(response.read().decode('utf-8'))
            assert "result" in data, f"Expected 'result' in response, got {data}"
            assert "data" in data["result"], f"Expected 'data' in result, got {data['result']}"
            assert "greeting" in data["result"]["data"], f"Expected 'greeting' in data, got {data['result']['data']}"
            assert data["result"]["data"]["greeting"] == "Hello, World", f"Expected 'Hello, World', got {data['result']['data']['greeting']}"
    except urllib.error.HTTPError as e:
        pytest.fail(f"HTTP request failed with status {e.code}: {e.read().decode('utf-8')}")
    except urllib.error.URLError as e:
        pytest.fail(f"Failed to connect to server: {e.reason}")
