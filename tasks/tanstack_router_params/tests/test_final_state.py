import pytest
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

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
