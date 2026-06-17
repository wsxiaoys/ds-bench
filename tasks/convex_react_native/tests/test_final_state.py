import pytest
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/my-app"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the Expo web app using xprocess. Confirms readiness via port check.
    """
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npx", "expo", "start", "--web", "--port", "8081"]
        env = os.environ.copy()
        env["EXPO_PUBLIC_CONVEX_URL"] = env.get("CONVEX_URL", "")
        env["EXPO_PUBLIC_RUN_ID"] = env.get("ZEALT_RUN_ID", "test-run-id")
        
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 8081)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_reactive_list(start_app, browser_verifier):
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run-id")
    task_text = f"Test Task {run_id}"
    reason = "The web application should load, allow adding a task, and reactively display the newly added task."
    truth = f"""
    1. Navigate to http://localhost:8081.
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
