import pytest
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
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
                return s.connect_ex(("localhost", 8765)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_home_route(start_app, browser_verifier):
    reason = "The home route (`/`) should display the text 'Home Page'."
    truth = "Navigate to http://localhost:8765/ and verify that the page contains the text 'Home Page'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_home_route"
    )
    assert result.status == "pass", f"Home route verification failed: {result.reason}"

def test_dynamic_route_numeric(start_app, browser_verifier):
    reason = "The dynamic route `/users/$userId` should display the numeric userId."
    truth = "Navigate to http://localhost:8765/users/123 and verify that the page contains the text 'User Profile: 123'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_dynamic_route_numeric"
    )
    assert result.status == "pass", f"Numeric dynamic route verification failed: {result.reason}"

def test_dynamic_route_string(start_app, browser_verifier):
    reason = "The dynamic route `/users/$userId` should display the string userId."
    truth = "Navigate to http://localhost:8765/users/alice and verify that the page contains the text 'User Profile: alice'."
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_dynamic_route_string"
    )
    assert result.status == "pass", f"String dynamic route verification failed: {result.reason}"
