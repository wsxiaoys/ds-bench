import pytest
import os
import socket
import subprocess
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the dev server using xprocess. Confirms readiness via port check.
    """
    # Ensure dependencies are installed just in case
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=False)

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
                return s.connect_ex(("localhost", 5123)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_infinite_scroll(start_app, browser_verifier):
    reason = "The application should display a feed of items and have a 'Load More' button to fetch and append the next page of items using TanStack Query useInfiniteQuery."
    truth = "Navigate to http://localhost:5123/. Verify that the page renders the first set of feed items. Count the number of item elements (e.g., list items). Find the button with the exact text 'Load More' and click it. Verify that the application fetches the next page and appends it to the list. The total number of item elements on the page should increase, proving that Page 2 was loaded and Page 1 was retained."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_infinite_scroll"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
