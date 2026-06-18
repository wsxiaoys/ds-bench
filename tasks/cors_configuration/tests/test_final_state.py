import os
import subprocess
import time
import socket
import urllib.request
import urllib.error
import pytest

PROJECT_DIR = "/home/user/project"

def wait_for_port(port, timeout=60):
    start_time = time.time()
    while time.time() - start_time < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('localhost', port)) == 0:
                return True
        time.sleep(1)
    return False

@pytest.fixture(scope="module")
def start_server():
    # Install dependencies
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)
    
    # Start the server
    process = subprocess.Popen(
        ["npx", "tsx", "index.ts"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    # Wait for the server to be ready
    if not wait_for_port(4000):
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("Server failed to start and listen on port 4000.")

    yield

    # Shut down the server
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_cors_options_request(start_server):
    req = urllib.request.Request("http://localhost:4000/hello", method="OPTIONS")
    req.add_header("Origin", "http://localhost:3000")
    req.add_header("Access-Control-Request-Method", "GET")
    
    try:
        response = urllib.request.urlopen(req)
        headers = dict(response.getheaders())
        
        allow_origin = headers.get("Access-Control-Allow-Origin")
        assert allow_origin == "http://localhost:3000" or allow_origin == "*", \
            f"Expected Access-Control-Allow-Origin to be http://localhost:3000 or *, got {allow_origin}"
    except urllib.error.HTTPError as e:
        pytest.fail(f"OPTIONS request failed with status {e.code}")

def test_valid_get_request(start_server):
    req = urllib.request.Request("http://localhost:4000/hello", method="GET")
    req.add_header("Origin", "http://localhost:3000")
    
    try:
        response = urllib.request.urlopen(req)
        assert response.status == 200, f"Expected status 200, got {response.status}"
        
        headers = dict(response.getheaders())
        allow_origin = headers.get("Access-Control-Allow-Origin")
        assert allow_origin == "http://localhost:3000" or allow_origin == "*", \
            f"Expected Access-Control-Allow-Origin to be http://localhost:3000 or *, got {allow_origin}"
    except urllib.error.HTTPError as e:
        pytest.fail(f"GET request failed with status {e.code}")

def test_invalid_origin_request(start_server):
    req = urllib.request.Request("http://localhost:4000/hello", method="GET")
    req.add_header("Origin", "http://example.com")
    
    try:
        response = urllib.request.urlopen(req)
        headers = dict(response.getheaders())
        allow_origin = headers.get("Access-Control-Allow-Origin")
        # If it succeeds, it should NOT allow example.com (unless it allows *)
        # But a strict CORS config should not allow example.com.
        # It's possible the server just omits the header.
        assert allow_origin != "http://example.com", \
            "CORS should not echo back an invalid origin."
        if allow_origin == "*":
            # If the server is configured to allow *, then any origin is allowed.
            # But the task requires allowing http://localhost:3000 specifically.
            pass 
    except urllib.error.HTTPError as e:
        # If the server rejects it with an error, that's fine too.
        pass
