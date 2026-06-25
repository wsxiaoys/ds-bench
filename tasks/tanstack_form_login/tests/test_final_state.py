import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

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

    pid, logpath = xprocess.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")

    yield

    # teardown: print the logs and terminate the service
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile when teardown =============================")
        print(logs)
        print("===== End: Captured xprocess logfile when teardown =============================")

    info = xprocess.getinfo(Starter.name)
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