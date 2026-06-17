import os
import subprocess
import time
import socket
import pytest
import signal
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

def test_client_uses_http_batch_stream_link():
    """Priority 3: Check if httpBatchStreamLink is used in the client code."""
    # The user might have modified Provider.tsx or client.ts. Let's just grep the src dir.
    result = subprocess.run(
        ["grep", "-rn", "httpBatchStreamLink", "src/"],
        cwd=PROJECT_DIR,
        capture_output=True, text=True
    )
    assert result.returncode == 0, "httpBatchStreamLink not found in any file under src/."
    
def test_server_procedure_uses_async_generator():
    """Priority 3: Check if the router uses async function* and yields."""
    router_path = os.path.join(PROJECT_DIR, "src/server/trpc/router.ts")
    with open(router_path, "r") as f:
        content = f.read()
    assert "chatStream" in content, "Procedure 'chatStream' not found in router.ts."
    assert "async function*" in content, "An 'async function*' generator was not found in router.ts."
    assert "yield" in content, "No 'yield' statement found in router.ts."

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
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on required ports.")
    
    yield
    
    # Shut down the app
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_browser_streaming_chat(start_app):
    reason = "The user must implement a streaming AI chat interface using tRPC httpBatchStreamLink. The page should display the streamed chunks."
    truth = "Navigate to http://localhost:3000. Verify that the page successfully receives the stream from the server and eventually displays the text 'Hello, World!'."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_streaming_chat"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
