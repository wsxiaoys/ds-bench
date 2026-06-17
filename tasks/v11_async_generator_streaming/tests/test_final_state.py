import os
import subprocess
import time
import socket
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
    # Ensure dependencies are installed before starting
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)
    
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

def test_async_streaming(start_app):
    reason = "The application should display streamed text chunks sequentially after clicking the trigger button, demonstrating the httpBatchStreamLink and AsyncGenerator functionality."
    truth = "Navigate to http://localhost:3000. Verify that a button to trigger the stream is visible. Click the button. Verify that the streamed chunks are displayed sequentially on the page, demonstrating that the httpBatchStreamLink and AsyncGenerator are working correctly."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_async_streaming"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
