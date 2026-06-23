import pytest
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
PORT = 6382

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """

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

def test_unauthenticated_access(start_app, browser_verifier):
    reason = "The dashboard page must be protected and redirect unauthenticated users to the login page."
    truth = f"Navigate to http://localhost:{PORT}/dashboard. Verify that the browser is redirected to the /login page."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_unauthenticated_access"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_login_flow(start_app, browser_verifier):
    reason = "The login page must allow a user to authenticate and redirect them to the dashboard."
    truth = f"Navigate to http://localhost:{PORT}/login. Click the button with text 'Login'. Verify that the browser is redirected to /dashboard and the page displays 'Welcome to Dashboard'."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_login_flow"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_logout_flow(start_app, browser_verifier):
    reason = "The dashboard page must allow an authenticated user to log out and redirect them to the login page."
    # We need to ensure we are logged in first, so the truth must include the login step.
    truth = f"Navigate to http://localhost:{PORT}/login. Click the button with text 'Login'. Wait for the redirect to /dashboard. While on the /dashboard page, click the button with text 'Logout'. Verify that the browser is redirected to /login."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_logout_flow"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"