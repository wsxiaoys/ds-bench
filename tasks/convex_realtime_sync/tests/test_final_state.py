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

    # Run npm install first to ensure dependencies are present
    if os.path.exists(PROJECT_DIR):
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

def test_collaborative_counter(start_app, app_port, browser_verifier):
    run_id = open("/logs/artifacts/run-id").read().strip()
    env = os.environ.copy()
    env["RUN_ID"] = run_id

    reason = "The application should feature a collaborative counter that updates in real-time across multiple clients."
    truth = f"""
    1. Open a new browser tab (Tab 1) and navigate to http://localhost:{app_port}.
    2. Verify that the page loads successfully and displays a counter and an "Increment" button.
    3. Note the current count. Click the "Increment" button in Tab 1 and verify the count increases by 1.
    4. Open a second browser tab (Tab 2) and navigate to http://localhost:{app_port}.
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
