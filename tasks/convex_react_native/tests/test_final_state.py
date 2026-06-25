import pytest
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/my-app"

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
