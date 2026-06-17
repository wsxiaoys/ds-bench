import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
PORT = 8432

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", PORT)) == 0

    xprocess.ensure(Starter.name, Starter)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_form_rendering(start_app, browser_verifier):
    reason = "The page should render an email input, a password input, and a submit button."
    truth = "Navigate to http://localhost:8432. Verify that the page contains an input for email, an input for password, and a submit button."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_form_rendering"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_email_validation(start_app, browser_verifier):
    reason = "Submitting with an invalid email should display a validation error."
    truth = "Navigate to http://localhost:8432. Enter an invalid email (e.g., 'not-an-email'), enter a valid password (e.g., 'password123'), and submit. Verify that an error message related to invalid email appears."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_email_validation"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_password_validation(start_app, browser_verifier):
    reason = "Submitting with a password shorter than 8 characters should display a validation error."
    truth = "Navigate to http://localhost:8432. Enter a valid email (e.g., 'test@example.com'), enter a short password (e.g., 'short'), and submit. Verify that an error message related to password length appears."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_password_validation"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_successful_submission(start_app, browser_verifier):
    reason = "Submitting with valid data should display a success message."
    truth = "Navigate to http://localhost:8432. Enter a valid email (e.g., 'test@example.com'), enter a valid password (e.g., 'password123'), and submit. Verify that the 'Login successful' message appears on the page."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_successful_submission"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"