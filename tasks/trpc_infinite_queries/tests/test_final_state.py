import os
import subprocess
import time
import socket
import signal
import pytest
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
    if not wait_for_port(3000, timeout=120):
        # Kill the process group before failing
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on port 3000.")

    yield

    # Shut down the app
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_infinite_queries(start_app):
    reason = "The application should display an initial list of posts and a 'Load More' button. Clicking the button should append more posts to the list until all posts are loaded, at which point the button should become disabled."
    truth = "Navigate to http://localhost:3000. Verify that the first page of posts is rendered (e.g., check for specific post titles). Verify that the 'Load More' button exists and is enabled. Click the 'Load More' button. Verify that the next page of posts is appended to the list. Click the 'Load More' button until all posts are loaded. Verify that the 'Load More' button is disabled when hasNextPage is false."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_infinite_queries"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
