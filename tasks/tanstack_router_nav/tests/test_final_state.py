import pytest
import subprocess
import os
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """
    
    # Run npm install before starting the app
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

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
            """
            Custom check: returns True if the target port is accepting connections.
            xprocess calls this repeatedly until it returns True or times out.
            """
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

def test_home_page(start_app, app_port, browser_verifier):
    reason = "The application should have a Home page at / with a navigation menu where the Home link is active."
    truth = f'Navigate to http://localhost:{app_port}/. Verify that the page loads successfully. Check the navigation menu and verify that the link to "/" has the "active" CSS class applied to it. Verify that the links to "/about" and "/contact" do NOT have the "active" class.'
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_home_page"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_about_page(start_app, app_port, browser_verifier):
    reason = "The application should have an About page at /about with a navigation menu where the About link is active."
    truth = f'Navigate to http://localhost:{app_port}/about. Verify that the page loads successfully. Check the navigation menu and verify that the link to "/about" has the "active" CSS class applied to it. Verify that the link to "/" does NOT have the "active" class.'
    
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_about_page"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

def test_contact_page(start_app, app_port, browser_verifier):
    reason = "The application should have a Contact page at /contact with a navigation menu where the Contact link is active."
    truth = f'Navigate to http://localhost:{app_port}/contact. Verify that the page loads successfully. Check the navigation menu and verify that the link to "/contact" has the "active" CSS class applied to it.'
    
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
