import os
import subprocess
import time
import socket
import json
import urllib.request
import urllib.parse
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

def test_nextjs_build_success():
    """Verify that the Next.js project builds successfully without TypeScript errors."""
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Next.js build failed. There might be TypeScript errors. Output:\n{result.stdout}\n{result.stderr}"

@pytest.fixture(scope="module")
def start_app():
    # Start the app
    process = subprocess.Popen(
        ["npm", "start"],
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

def test_user_endpoint(start_app):
    """Verify that the user.getUser endpoint works correctly."""
    input_data = '{"json":{"id":"1"}}'
    encoded_input = urllib.parse.quote(input_data)
    url = f"http://localhost:3000/api/trpc/user.getUser?input={encoded_input}"
    
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as response:
            assert response.status == 200
            data = json.loads(response.read().decode('utf-8'))
            assert "result" in data
            assert "data" in data["result"]
            assert data["result"]["data"].get("id") == "1"
            assert data["result"]["data"].get("name") == "Alice"
    except urllib.error.URLError as e:
        pytest.fail(f"Failed to fetch user endpoint: {e}")

def test_post_endpoint(start_app):
    """Verify that the post.getPost endpoint works correctly."""
    input_data = '{"json":{"id":"1"}}'
    encoded_input = urllib.parse.quote(input_data)
    url = f"http://localhost:3000/api/trpc/post.getPost?input={encoded_input}"
    
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as response:
            assert response.status == 200
            data = json.loads(response.read().decode('utf-8'))
            assert "result" in data
            assert "data" in data["result"]
            assert data["result"]["data"].get("id") == "1"
            assert data["result"]["data"].get("title") == "Hello World"
    except urllib.error.URLError as e:
        pytest.fail(f"Failed to fetch post endpoint: {e}")
