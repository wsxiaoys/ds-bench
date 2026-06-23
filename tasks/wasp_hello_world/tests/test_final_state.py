import os
import subprocess
import time
import socket
import pytest
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/my-app"

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
        ["wasp", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid
    )
    
    # Wait for the app to be ready
    if not wait_for_port(3000):
        # Kill the process group before failing
        import signal
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        pytest.fail("Wasp app failed to start and listen on port 3000.")
    
    yield
    
    # Shut down the app
    import signal
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except ProcessLookupError:
        pass
    process.wait(timeout=30)

def test_hello_page_content(start_app):
    reason = "The user should have added a new page at /hello that displays 'Hello Wasp!'"
    truth = "Navigate to http://localhost:3000/hello. Verify that the text 'Hello Wasp!' is visible on the page."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_hello_page"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_files_exist():
    wasp_file = os.path.join(PROJECT_DIR, "main.wasp")
    hello_page_file = os.path.join(PROJECT_DIR, "src/HelloPage.tsx")
    
    assert os.path.isfile(wasp_file), "main.wasp is missing."
    assert os.path.isfile(hello_page_file), "src/HelloPage.tsx is missing."
    
    with open(wasp_file, "r") as f:
        content = f.read()
    assert "page HelloPage" in content, "HelloPage declaration missing in main.wasp"
    assert "route HelloRoute" in content, "HelloRoute declaration missing in main.wasp"
    assert "/hello" in content, "Path /hello missing in main.wasp"
