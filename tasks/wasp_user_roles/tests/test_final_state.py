import os
import subprocess
import time
import socket
import pytest
import signal
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/user-roles"

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
        "src/MainPage.tsx",
        "src/AdminPage.tsx"
    ]
    for f in required_files:
        path = os.path.join(PROJECT_DIR, f)
        assert os.path.isfile(path), f"Required file {path} is missing."

def test_browser_verification(start_app):
    reason = "The Wasp User Roles application should restrict access to the Admin page based on the user's role."
    truth = (
        "1. Navigate to http://localhost:3000/signup. Create an account with username 'john' and password 'password123'. "
        "2. Navigate to http://localhost:3000/admin. Verify that the user 'john' (role USER) CANNOT see 'Admin Panel' (should be redirected or see 'Access Denied'). "
        "3. Logout and navigate to http://localhost:3000/signup. Create an account with username 'admin' and password 'password123'. "
        "4. Navigate to http://localhost:3000/admin. Verify that the user 'admin' (role ADMIN) CAN see 'Admin Panel'. "
        "5. Navigate to http://localhost:3000/. Verify that the admin can also see 'Welcome admin'."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
