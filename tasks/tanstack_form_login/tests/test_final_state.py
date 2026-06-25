import pytest
import subprocess
import os
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="session")
def browser_verifier():
    """Create the PochiVerifier instance."""
    return PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--port", str(app_port)]
        env = os.environ.copy()
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

def test_form_rendering(start_app, app_port, browser_verifier):
    reason = "The page should render an email input, a password input, and a submit button."
    truth = f"Navigate to http://localhost:{app_port}. Verify that the page contains an input for email, an input for password, and a submit button."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_form_rendering"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_email_validation(start_app, app_port, browser_verifier):
    reason = "Submitting with an invalid email should display a validation error."
    truth = f"Navigate to http://localhost:{app_port}. Enter an invalid email (e.g., 'not-an-email'), enter a valid password (e.g., 'password123'), and submit. Verify that an error message related to invalid email appears."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_email_validation"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_password_validation(start_app, app_port, browser_verifier):
    reason = "Submitting with a password shorter than 8 characters should display a validation error."
    truth = f"Navigate to http://localhost:{app_port}. Enter a valid email (e.g., 'test@example.com'), enter a short password (e.g., 'short'), and submit. Verify that an error message related to password length appears."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_password_validation"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_successful_submission(start_app, app_port, browser_verifier):
    reason = "Submitting with valid data should display a success message."
    truth = f"Navigate to http://localhost:{app_port}. Enter a valid email (e.g., 'test@example.com'), enter a valid password (e.g., 'password123'), and submit. Verify that the 'Login successful' message appears on the page."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_successful_submission"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"