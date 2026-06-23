import os
import subprocess
import time
import socket
import pytest
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/app"

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
        ["npm", "start"],
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

def test_chat_interface(start_app):
    reason = "The application should feature a streaming chat interface where a user can enter a message and see the response streamed character by character."
    truth = "Navigate to http://localhost:3000. Verify that an input field with id 'chat-input' and a button with id 'chat-submit' are visible. Type 'Hello tRPC' into the input field and click the submit button. Verify that a response area with id 'chat-response' becomes visible and eventually displays the full text 'Hello tRPC' (streamed character by character)."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_chat_interface"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_http_batch_stream_link_used():
    # Priority 3 fallback: check if httpBatchStreamLink is used in the codebase
    grep_result = subprocess.run(
        ["grep", "-r", "httpBatchStreamLink", PROJECT_DIR],
        capture_output=True, text=True
    )
    assert "httpBatchStreamLink" in grep_result.stdout, \
        "Expected 'httpBatchStreamLink' to be used in the project to enable streaming."

def test_async_generator_used():
    # Priority 3 fallback: check if async generator syntax is used in the codebase
    grep_result = subprocess.run(
        ["grep", "-rE", r"async\s+function\s*\*", PROJECT_DIR],
        capture_output=True, text=True
    )
    assert grep_result.returncode == 0 and grep_result.stdout.strip() != "", \
        "Expected 'async function*' (AsyncGenerator) to be used for the tRPC procedure."
