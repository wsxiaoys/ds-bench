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
    build_process = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    if build_process.returncode != 0:
        pytest.fail(f"App failed to build: {build_process.stderr}")

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

def test_file_upload_via_browser_and_check_disk(start_app):
    reason = "The application should allow users to upload a file via a form. After submission, the tRPC mutation should complete successfully and the UI should display the uploaded image."
    truth = "Navigate to http://localhost:3000. Verify that a file input is visible. Upload the file /home/user/test-image.png using the file input. Submit the form. Verify that the file upload completes successfully and the uploaded image is displayed on the page."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_file_upload_via_browser"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    # After successful upload, check if the file exists on disk
    uploads_dir = os.path.join(PROJECT_DIR, "public", "uploads")
    
    assert os.path.isdir(uploads_dir), f"Uploads directory not found at {uploads_dir}"
    
    uploaded_files = os.listdir(uploads_dir)
    assert len(uploaded_files) > 0, "No files found in the public/uploads directory. Expected the uploaded file to be saved here."
