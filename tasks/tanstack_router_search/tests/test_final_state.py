import pytest
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
    """
    Starts the npm run dev service using xprocess. Confirms readiness via port check.
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


def test_search_page_initial_load(start_app, app_port, browser_verifier):
    reason = "The /search page should read query parameters from the URL and populate the corresponding input fields."
    truth = f"Navigate to http://localhost:{app_port}/search?q=apple&category=fruit&minPrice=10&maxPrice=50. Verify that the page loads successfully. Verify that the input with name='q' has the value 'apple', name='category' has 'fruit', name='minPrice' has '10', and name='maxPrice' has '50'."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_search_page_initial_load"
    )
    assert result.status == "pass", f"Initial load verification failed: {result.reason}"

def test_search_page_update_inputs(start_app, app_port, browser_verifier):
    reason = "Updating the input fields should automatically sync their values to the URL search parameters without a full page reload."
    truth = f"Navigate to http://localhost:{app_port}/search?q=apple&category=fruit&minPrice=10&maxPrice=50. Change the value of the input with name='q' to 'banana'. Verify that the URL updates to include 'q=banana'. Then change the value of the input with name='minPrice' to '20'. Verify that the URL updates to include 'minPrice=20'."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_search_page_update_inputs"
    )
    assert result.status == "pass", f"Update inputs verification failed: {result.reason}"
