import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/tanstack-form-wizard"

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

def test_form_wizard(start_app, app_port, browser_verifier):
    reason = "The application should feature a multi-step registration form with TanStack Form and Zod validation. It must validate inputs on change and show success message upon valid submission."
    truth = f"""Navigate to http://localhost:{app_port}.
Click 'Next' button.
Verify validation error text appears indicating minimum length requirements for firstName and lastName.
Type 'John' in firstName and 'Doe' in lastName.
Click 'Next'.
Verify Step 2 renders, showing email and password inputs.
Type 'invalid-email' in email and 'pass' in password.
Click 'Submit'.
Verify validation error text appears for both email and password.
Change email to 'john@example.com' and password to 'secret123'.
Click 'Submit'.
Verify an element with id='success-message' appears containing the text 'john@example.com'.
"""
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_form_wizard"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
