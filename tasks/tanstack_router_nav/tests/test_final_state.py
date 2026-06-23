import pytest
import subprocess
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
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """
    
    # Run npm install before starting the app
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

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
            """
            Custom check: returns True if port 4273 is accepting connections.
            xprocess calls this repeatedly until it returns True or times out.
            """
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 4273)) == 0

    xprocess.ensure(Starter.name, Starter)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_home_page(start_app, browser_verifier):
    reason = "The application should have a Home page at / with a navigation menu where the Home link is active."
    truth = 'Navigate to http://localhost:4273/. Verify that the page loads successfully. Check the navigation menu and verify that the link to "/" has the "active" CSS class applied to it. Verify that the links to "/about" and "/contact" do NOT have the "active" class.'
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_home_page"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_about_page(start_app, browser_verifier):
    reason = "The application should have an About page at /about with a navigation menu where the About link is active."
    truth = 'Navigate to http://localhost:4273/about. Verify that the page loads successfully. Check the navigation menu and verify that the link to "/about" has the "active" CSS class applied to it. Verify that the link to "/" does NOT have the "active" class.'
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_about_page"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_contact_page(start_app, browser_verifier):
    reason = "The application should have a Contact page at /contact with a navigation menu where the Contact link is active."
    truth = 'Navigate to http://localhost:4273/contact. Verify that the page loads successfully. Check the navigation menu and verify that the link to "/contact" has the "active" CSS class applied to it.'
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_contact_page"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_type_safety():
    """Verify that routeTree.gen.ts is generated."""
    src_route_tree = os.path.join(PROJECT_DIR, "src", "routeTree.gen.ts")
    app_route_tree = os.path.join(PROJECT_DIR, "app", "routeTree.gen.ts")
    
    assert os.path.isfile(src_route_tree) or os.path.isfile(app_route_tree), \
        f"routeTree.gen.ts not found in {PROJECT_DIR}/src or {PROJECT_DIR}/app"
