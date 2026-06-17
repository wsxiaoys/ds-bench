import os
import subprocess
import time
import socket
import urllib.request
import json
import pytest
from pochi_verifier import PochiVerifier

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
    """Test the tRPC API endpoint directly."""
    url = 'http://localhost:3000/api/trpc/hello?input="world"'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            assert "result" in data, "Expected 'result' in tRPC response"
            assert "data" in data["result"], "Expected 'data' in tRPC response result"
            assert data["result"]["data"] == "Hello world", f"Expected 'Hello world', got {data['result']['data']}"
    except Exception as e:
        pytest.fail(f"API request failed: {e}")

def test_client_render(start_app):
    """Test the client render using browser verification."""
    verifier = PochiVerifier()
    result = verifier.verify(
        reason="The Next.js application should render the result of the tRPC hello query.",
        truth="Navigate to http://localhost:3000. Verify that the page contains an element with id 'result' and the text 'Hello tRPC v11'.",
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_client_render"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
