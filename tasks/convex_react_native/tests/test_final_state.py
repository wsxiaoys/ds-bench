import pytest
import os
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/my-app"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the Expo web app using xprocess. Confirms readiness via port check.
    """
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npx", "expo", "start", "--web", "--port", str(app_port)]
        env = os.environ.copy()
        env["EXPO_PUBLIC_CONVEX_URL"] = env.get("CONVEX_URL", "")
        env["EXPO_PUBLIC_RUN_ID"] = open("/logs/artifacts/run-id").read().strip()

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

def test_reactive_list(start_app, app_port, browser_verifier):
    run_id = open("/logs/artifacts/run-id").read().strip()
    task_text = f"Test Task {run_id}"
    reason = "The web application should load, allow adding a task, and reactively display the newly added task."
    truth = f"""
    1. Navigate to http://localhost:{app_port}.
    2. Verify that the page loads without errors.
    3. Find the input element with `data-testid="task-input"`.
    4. Type "{task_text}" into the input.
    5. Find the button with `data-testid="add-button"` and click it.
    6. Wait for an element with `data-testid="task-item"` containing the text "{task_text}" to appear on the page.
    7. Verify that the task list updates reactively to include the newly added task.
    """

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_reactive_list"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
