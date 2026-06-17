import os
import subprocess
import time
import socket
import pytest
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

def wait_for_port(port, timeout=120):
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
        # Kill the process group before failing
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("App failed to start and listen on required ports.")

    yield

    # Shut down the app
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_caller_factory_used_in_codebase():
    """Verify that createCallerFactory is used in the codebase to create the tRPC caller."""
    result = subprocess.run(
        ["grep", "-r", "--exclude-dir=node_modules", "--exclude-dir=.next", "createCallerFactory", PROJECT_DIR],
        capture_output=True, text=True
    )
    
    assert "createCallerFactory" in result.stdout, \
        "Expected createCallerFactory to be used in the codebase."

def test_server_action_used_in_codebase():
    """Verify that a Server Action is defined in the codebase."""
    result = subprocess.run(
        ["grep", "-r", "--exclude-dir=node_modules", "--exclude-dir=.next", "\"use server\"", PROJECT_DIR],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        result = subprocess.run(
            ["grep", "-r", "--exclude-dir=node_modules", "--exclude-dir=.next", "'use server'", PROJECT_DIR],
            capture_output=True, text=True
        )
    assert result.returncode == 0 and "use server" in result.stdout.lower(), \
        "Expected a Server Action ('use server') to be defined in the codebase."

def test_server_action_integration(start_app):
    reason = "The application should have a form that triggers a Server Action which calls a tRPC mutation."
    truth = "Navigate to http://localhost:3000. Fill the form with the test message 'Hello via Server Action' and submit it. Verify that the page displays the returned message confirming the Server Action was executed successfully (e.g. showing { success: true, message: 'Hello via Server Action' } or similar confirmation)."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_server_action_integration"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
