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
    
    # Run npm install first to ensure dependencies are present
    if os.path.exists(PROJECT_DIR):
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
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 5173)) == 0

    xprocess.ensure(Starter.name, Starter)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_collaborative_counter(start_app, browser_verifier):
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    
    reason = "The application should feature a collaborative counter that updates in real-time across multiple clients."
    truth = f"""
    1. Open a new browser tab (Tab 1) and navigate to http://localhost:5173.
    2. Verify that the page loads successfully and displays a counter and an "Increment" button.
    3. Note the current count. Click the "Increment" button in Tab 1 and verify the count increases by 1.
    4. Open a second browser tab (Tab 2) and navigate to http://localhost:5173.
    5. Verify that Tab 2 displays the exact same count as Tab 1.
    6. Click the "Increment" button in Tab 2. Verify the count increases by 1 in Tab 2.
    7. Switch back to Tab 1 and verify that its UI has updated reactively to match the new count from Tab 2.
    """

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_collaborative_counter"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
