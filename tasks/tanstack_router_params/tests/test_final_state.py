import pytest
import os
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()

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

def test_home_route(start_app, app_port, browser_verifier):
    reason = "The home route (`/`) should display the text 'Home Page'."
    truth = f"Navigate to http://localhost:{app_port}/ and verify that the page contains the text 'Home Page'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_home_route"
    )
    assert result.status == "pass", f"Home route verification failed: {result.reason}"

def test_dynamic_route_numeric(start_app, app_port, browser_verifier):
    reason = "The dynamic route `/users/$userId` should display the numeric userId."
    truth = f"Navigate to http://localhost:{app_port}/users/123 and verify that the page contains the text 'User Profile: 123'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_dynamic_route_numeric"
    )
    assert result.status == "pass", f"Numeric dynamic route verification failed: {result.reason}"

def test_dynamic_route_string(start_app, app_port, browser_verifier):
    reason = "The dynamic route `/users/$userId` should display the string userId."
    truth = f"Navigate to http://localhost:{app_port}/users/alice and verify that the page contains the text 'User Profile: alice'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_dynamic_route_string"
    )
    assert result.status == "pass", f"String dynamic route verification failed: {result.reason}"
