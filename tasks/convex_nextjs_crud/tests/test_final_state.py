import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/task-manager"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the Next.js app using xprocess. Confirms readiness via port check.
    """
    # First run npm install to ensure dependencies are present
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
            Custom check: returns True if port 3000 is accepting connections.
            """
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 3000)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_browser_task_manager(start_app, browser_verifier):
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run-id")
    task_text = f"Test Task {run_id}"

    reason = "The application should allow users to create, toggle, and delete tasks. It should filter tasks by the current runId."
    truth = f"""
1. Navigate to http://localhost:3000
2. Find the input field (e.g., `data-testid="task-input"`) and enter `{task_text}`.
3. Click the add button (e.g., `data-testid="add-button"`).
4. Verify that the task `{task_text}` appears in a `data-testid="task-item"` element.
5. Find the toggle button (e.g., `data-testid="toggle-button"`) inside the `{task_text}` item and click it.
6. Verify that the UI reflects the task is completed.
7. Find the delete button (e.g., `data-testid="delete-button"`) inside the `{task_text}` item and click it.
8. Verify that `{task_text}` is no longer visible on the page.
"""

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_task_manager"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
