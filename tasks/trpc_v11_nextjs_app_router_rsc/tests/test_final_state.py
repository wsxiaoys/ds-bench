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
    # Build the app
    build_process = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    if build_process.returncode != 0:
        pytest.fail(f"npm run build failed: {build_process.stderr.decode('utf-8')}")

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
        pytest.fail("App failed to start and listen on required ports.")
    
    yield
    
    # Shut down the app
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=30)

def test_app_router_data_fetching(start_app):
    reason = "The application should render data fetched from tRPC on the server and on the client."
    truth = "Navigate to http://localhost:3000. Verify that the page contains an `h1` element with id `server-data` and text `Hello Server`. Verify that the page contains a `p` element with id `client-data` and text `Hello Client`."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_app_router_data_fetching"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
