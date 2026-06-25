import pytest
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """

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

    # ensure() starts the process and blocks until startup_check is True
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

def test_unauthenticated_access(start_app, app_port, browser_verifier):
    reason = "The dashboard page must be protected and redirect unauthenticated users to the login page."
    truth = f"Navigate to http://localhost:{app_port}/dashboard. Verify that the browser is redirected to the /login page."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_unauthenticated_access"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_login_flow(start_app, app_port, browser_verifier):
    reason = "The login page must allow a user to authenticate and redirect them to the dashboard."
    truth = f"Navigate to http://localhost:{app_port}/login. Click the button with text 'Login'. Verify that the browser is redirected to /dashboard and the page displays 'Welcome to Dashboard'."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_login_flow"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_logout_flow(start_app, app_port, browser_verifier):
    reason = "The dashboard page must allow an authenticated user to log out and redirect them to the login page."
    # We need to ensure we are logged in first, so the truth must include the login step.
    truth = f"Navigate to http://localhost:{app_port}/login. Click the button with text 'Login'. Wait for the redirect to /dashboard. While on the /dashboard page, click the button with text 'Logout'. Verify that the browser is redirected to /login."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_logout_flow"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
