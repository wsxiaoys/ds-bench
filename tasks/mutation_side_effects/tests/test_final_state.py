import os
import subprocess
import time
import socket
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
    # Build the app
    subprocess.run(["npm", "run", "build"], cwd=PROJECT_DIR, check=True)

    # Start the app
    process = subprocess.Popen(
        ["npm", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )

    # Wait for the app to be ready
    if not wait_for_port(3000, timeout=120):
        # Kill the process group before failing
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on required ports.")

    yield

    # Shut down the app
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_mutation_side_effect(start_app):
    reason = "The application should update the todo list automatically after a new todo is added without a manual page refresh."
    truth = "Navigate to http://localhost:3000. Verify that an input field for adding new to-do items is visible. Click the input field, type 'Learn tRPC mutation', and press Enter (or click the Add button). Verify that 'Learn tRPC mutation' appears in the to-do list immediately without a manual page refresh."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_mutation_side_effect"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
