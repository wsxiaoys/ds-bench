import os
import subprocess
import time
import socket
import pytest
import json
import urllib.request
import urllib.error
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

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
    if not wait_for_port(3000):
        # Kill the process group before failing
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on port 3000.")

    yield

    # Shut down the app
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_api_endpoint(start_app):
    """Priority 1: Verify the API endpoint directly."""
    url = 'http://localhost:3000/api/trpc/hello?input=%22World%22'
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            assert "result" in data, f"Unexpected response format: {data}"
            assert data["result"]["data"] == "Hello World", f"Expected 'Hello World', got {data['result']['data']}"
    except urllib.error.URLError as e:
        pytest.fail(f"Failed to fetch API endpoint: {e}")

def test_browser_rendering(start_app):
    """Priority 2: Use PochiVerifier to check the browser rendering."""
    reason = "The main page should render the greeting fetched from the tRPC endpoint."
    truth = "Navigate to http://localhost:3000. Verify that the page contains the exact text 'Hello World'."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_rendering"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
