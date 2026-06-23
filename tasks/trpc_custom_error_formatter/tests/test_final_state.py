import os
import subprocess
import time
import socket
import json
import pytest

PROJECT_DIR = "/home/user/app"

def wait_for_port(port, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('localhost', port)) == 0:
                return True
        time.sleep(1)
    return False

@pytest.fixture(scope="module")
def start_app():
    process = subprocess.Popen(
        ["npm", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    if not wait_for_port(3000):
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on port 3000.")

    yield

    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_invalid_payload_returns_zod_error(start_app):
    """Priority 1: Use curl to verify the API response for an invalid payload."""
    payload = json.dumps({"title": "a"})
    result = subprocess.run(
        [
            "curl", "-s", "-X", "POST",
            "-H", "Content-Type: application/json",
            "-d", payload,
            "http://localhost:3000/trpc/addPost"
        ],
        capture_output=True, text=True
    )
    
    assert result.returncode == 0, f"curl command failed: {result.stderr}"
    
    try:
        response_data = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON response: {result.stdout}")
        
    assert "error" in response_data, f"Expected 'error' in response, got: {response_data}"
    
    error_data = response_data["error"].get("data", {})
    assert "zodError" in error_data and error_data["zodError"] is not None, \
        f"Expected 'zodError' in error.data, got: {error_data}"
        
    zod_error = error_data["zodError"]
    assert "fieldErrors" in zod_error, f"Expected 'fieldErrors' in zodError, got: {zod_error}"
    assert "title" in zod_error["fieldErrors"], f"Expected 'title' in fieldErrors, got: {zod_error['fieldErrors']}"

def test_valid_payload_succeeds(start_app):
    """Priority 1: Use curl to verify the API response for a valid payload."""
    payload = json.dumps({"title": "valid title"})
    result = subprocess.run(
        [
            "curl", "-s", "-X", "POST",
            "-H", "Content-Type: application/json",
            "-d", payload,
            "http://localhost:3000/trpc/addPost"
        ],
        capture_output=True, text=True
    )
    
    assert result.returncode == 0, f"curl command failed: {result.stderr}"
    
    try:
        response_data = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse JSON response: {result.stdout}")
        
    assert "result" in response_data, f"Expected 'result' in response for successful request, got: {response_data}"
