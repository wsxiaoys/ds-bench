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
def start_server():
    process = subprocess.Popen(
        ["npm", "run", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    if not wait_for_port(3000):
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("Server failed to start on port 3000.")

    yield

    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_unauthorized_request(start_server):
    result = subprocess.run(
        ["curl", "-s", "-w", "%{http_code}", "http://localhost:3000/secretData"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"curl command failed: {result.stderr}"
    
    output = result.stdout
    http_code = output[-3:]
    body = output[:-3]
    
    assert http_code == "401", f"Expected HTTP 401 UNAUTHORIZED, got {http_code}. Response body: {body}"
    
    try:
        data = json.loads(body)
        assert "error" in data, f"Expected tRPC error response, got: {body}"
        assert "UNAUTHORIZED" in body, f"Expected UNAUTHORIZED error code, got: {body}"
    except json.JSONDecodeError:
        pytest.fail(f"Expected JSON response, got: {body}")

def test_authorized_request(start_server):
    result = subprocess.run(
        ["curl", "-s", "-w", "%{http_code}", "-H", "Authorization: Bearer mysecrettoken", "http://localhost:3000/secretData"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"curl command failed: {result.stderr}"
    
    output = result.stdout
    http_code = output[-3:]
    body = output[:-3]
    
    assert http_code == "200", f"Expected HTTP 200 OK, got {http_code}. Response body: {body}"
    
    try:
        data = json.loads(body)
        assert "result" in data, f"Expected tRPC result in response, got: {body}"
        assert "data" in data["result"], f"Expected data in tRPC result, got: {body}"
        assert data["result"]["data"].get("secret") == "super secret", f"Expected secret data 'super secret', got: {body}"
    except json.JSONDecodeError:
        pytest.fail(f"Expected JSON response, got: {body}")
