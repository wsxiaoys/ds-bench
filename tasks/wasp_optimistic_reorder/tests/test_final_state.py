import os
import subprocess
import time
import socket
import pytest
import signal
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/optimistic-reorder"

def wait_for_port(port, timeout=150):
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
        ["wasp", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    
    # Wait for the app to be ready
    if not wait_for_port(3000):
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        pytest.fail("Wasp app failed to start on port 3000 within timeout.")
    
    yield
    
    # Shut down
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        process.wait(timeout=30)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        pass

def test_files_exist():
    required_files = [
        "main.wasp",
        "schema.prisma",
        "src/actions.ts",
        "src/MainPage.tsx"
    ]
    for f in required_files:
        path = os.path.join(PROJECT_DIR, f)
        assert os.path.isfile(path), f"Required file {path} is missing."

def test_browser_verification(start_app):
    reason = "The Wasp Optimistic Reorder application should correctly swap task positions and maintain state."
    truth = (
        "1. Navigate to http://localhost:3000. "
        "2. Create three tasks: 'Task A', 'Task B', 'Task C'. Verify they appear in that order. "
        "3. Click the 'Move Up' button for 'Task B'. Verify 'Task B' is now above 'Task A'. "
        "4. Refresh the page. Verify the order is still 'Task B', 'Task A', 'Task C'. "
        "5. Click 'Move Up' for 'Task C'. Verify 'Task C' is now above 'Task A'. "
        "6. Refresh. Verify the final order is 'Task B', 'Task C', 'Task A'."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
