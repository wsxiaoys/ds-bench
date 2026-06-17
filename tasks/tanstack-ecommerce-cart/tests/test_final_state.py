import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/ecommerce-cart"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the npm run dev service using xprocess. Confirms readiness via port check.
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
                return s.connect_ex(("localhost", 8432)) == 0

    xprocess.ensure(Starter.name, Starter)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_code_inspection():
    """Verify that TanStack Query and TanStack Router are used in the source code."""
    # Search for useQuery and routing APIs in src or app directory
    cmd = ["grep", "-rnE", "useQuery|@tanstack/react-query|@tanstack/react-router", PROJECT_DIR]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    assert "@tanstack/react-query" in result.stdout or "useQuery" in result.stdout, \
        "Could not find usage of TanStack Query (useQuery or @tanstack/react-query) in the source code."
    assert "@tanstack/react-router" in result.stdout, \
        "Could not find usage of TanStack Router (@tanstack/react-router) in the source code."

def test_ecommerce_cart_browser(start_app, browser_verifier):
    reason = "The application should display products, allow adding them to a cart, and sync the cart state to the URL search parameters."
    truth = "Navigate to http://localhost:8432/. Verify that the page loads and displays a list of products. Simulate clicking an 'Add to Cart' button for a product. Verify that the URL updates to include the cart state in the search parameters, and the UI displays the item in the cart. Note the current URL. Then navigate directly to that URL in a new browser context. Verify that the cart UI correctly displays the item based purely on the URL search parameters."

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_ecommerce_cart_browser"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
