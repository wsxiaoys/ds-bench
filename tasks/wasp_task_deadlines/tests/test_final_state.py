import os
import subprocess
import time
import socket
import pytest
import signal
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/task-deadlines"

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
        "src/queries.ts",
        "src/actions.ts",
        "src/MainPage.tsx"
    ]
    for f in required_files:
        path = os.path.join(PROJECT_DIR, f)
        assert os.path.isfile(path), f"Required file {path} is missing."

def test_browser_verification(start_app):
    reason = "The Wasp Task Deadlines application should correctly filter overdue tasks."
    truth = (
        "1. Navigate to http://localhost:3000. "
        "2. Create a task 'Future task' with a due date in the year 2099. "
        "3. Create a task 'Overdue task' with a due date in the year 2020. "
        "4. Verify that both tasks are initially visible in the list. "
        "5. Click the 'Show Overdue Only' checkbox/button. Verify that only 'Overdue task' is visible. "
        "6. Uncheck the 'Show Overdue Only' filter. Verify that both tasks are visible again."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
