import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/tanstack-form-wizard"
PORT = 7345

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--port", str(PORT)]
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

def test_form_wizard(start_app, browser_verifier):
    reason = "The application should feature a multi-step registration form with TanStack Form and Zod validation. It must validate inputs on change and show success message upon valid submission."
    truth = """Navigate to http://localhost:7345.
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
