import pytest
import os
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

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
