import os
import pytest
import requests
import socket
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    # First run go mod tidy
    import subprocess
    subprocess.run(["go", "mod", "tidy"], cwd=PROJECT_DIR, check=True)

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["go", "run", "main.go", "serve", f"--http=0.0.0.0:{app_port}"]

        env = os.environ.copy()
        env["AWS_REGION"] = "us-east-1"
        env["AWS_ACCESS_KEY_ID"] = "AKIAIOSFODNN7EXAMPLE"
        env["AWS_SECRET_ACCESS_KEY"] = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        env["AWS_BUCKET"] = "my-test-bucket"

        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0

    info = xprocess.getinfo(Starter.name)

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            logs = f.read()
            print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
            print(logs)
            print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()

def test_missing_filename_parameter(start_app, app_port):
    """Verify that a request without the filename parameter returns status 400."""
    response = requests.get(f"http://localhost:{app_port}/api/s3-presign")
    assert response.status_code == 400, f"Expected status 400 for missing filename, got {response.status_code}"

def test_generate_presigned_url(start_app, app_port):
    """Verify that a valid request returns a presigned URL in the correct format."""
    run_id = open("/logs/artifacts/run-id").read().strip()
    response = requests.get(f"http://localhost:{app_port}/api/s3-presign?filename=test_video.mp4")

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Response: {response.text}"

    data = response.json()
    assert "url" in data, f"Expected 'url' in response JSON, got {data}"

    url = data["url"]

    # Verify the URL format. AWS SDK might generate virtual-hosted style or path style.
    # Virtual-hosted style: https://my-test-bucket.s3.us-east-1.amazonaws.com/uploads/<run-id>/test_video.mp4
    # Path style: https://s3.us-east-1.amazonaws.com/my-test-bucket/uploads/<run-id>/test_video.mp4

    expected_path = f"uploads/{run_id}/test_video.mp4"
    assert expected_path in url, f"Expected path '{expected_path}' in URL, got {url}"
    assert "my-test-bucket" in url, f"Expected bucket name 'my-test-bucket' in URL, got {url}"
    assert "X-Amz-Signature=" in url, f"Expected 'X-Amz-Signature' in URL query parameters, got {url}"
    assert "X-Amz-Algorithm=" in url, f"Expected 'X-Amz-Algorithm' in URL query parameters, got {url}"
