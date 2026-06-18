import os
import subprocess
import time
import socket
import pytest
import urllib.request
import json

PROJECT_DIR = "/home/user/myproject"

def wait_for_port(port, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('localhost', port)) == 0:
                return True
        time.sleep(5)
    return False

@pytest.fixture(scope="module")
def start_app():
    # Start the app
    process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    # Wait for the app to be ready
    if not wait_for_port(3000, timeout=120):
        # Kill the process group before failing
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on port 3000.")

    yield

    # Shut down the app
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_get_user_with_header(start_app):
    url = "http://localhost:3000/api/trpc/getUser"
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

def test_get_user_without_header(start_app):
    url = "http://localhost:3000/api/trpc/getUser"
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
