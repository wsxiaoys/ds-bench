import os
import subprocess
import time
import socket
import json
import pytest

PROJECT_DIR = "/home/user/project"

def wait_for_port(port, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('localhost', port)) == 0:
                return True
        time.sleep(2)
    return False

@pytest.fixture(scope="module")
def start_app():
    # Start the app
    process = subprocess.Popen(
        ["node", "index.js"],
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

def test_trpc_endpoint(start_app):
    """Verify the tRPC endpoint works correctly."""
    result = subprocess.run(
        ["curl", "-s", "http://localhost:3000/trpc/greeting?input=%7B%22name%22%3A%22World%22%7D"],
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

def test_trpc_panel_html(start_app):
    """Verify the trpc-panel UI is served."""
    result = subprocess.run(
        ["curl", "-s", "http://localhost:3000/panel"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"curl failed: {result.stderr}"
    
    # trpc-panel returns an HTML page containing "tRPC Panel" or similar identifiers.
    # The exact string might vary, but it should be HTML and contain "trpc" or "panel".
    assert "<html" in result.stdout.lower() or "<!doctype html>" in result.stdout.lower(), \
        f"Expected HTML response, got: {result.stdout[:100]}..."
    assert "trpc" in result.stdout.lower(), \
        "Expected 'trpc' in the HTML response."
