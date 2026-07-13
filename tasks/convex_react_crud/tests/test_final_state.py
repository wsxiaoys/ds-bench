import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/my-app"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def setup_npm_install():
    """Install dependencies before starting."""
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

@pytest.fixture(scope="session")
def start_app(setup_npm_install, xprocess):
    """
    Starts the npm dev server using xprocess. Confirms readiness via port check.
    """
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        env = os.environ.copy()

        # Pass required environment variables
        run_id = open("/logs/artifacts/run-id").read().strip()
        convex_url = os.environ.get("CONVEX_URL", "")
        env["VITE_RUN_ID"] = run_id
        env["VITE_CONVEX_URL"] = convex_url

        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 5173)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0  # track how many lines have already been printed

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
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


def test_browser_add_task(start_app, browser_verifier):
    run_id = open("/logs/artifacts/run-id").read().strip()
    task_text = f"Test Task for {run_id}"

    reason = "The user should be able to add a new task."
    truth = f"Navigate to http://127.0.0.1:5173. Locate the text input field, type '{task_text}', and click the submit button. Verify that the new task '{task_text}' appears in the task list."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_add_task"
    )
    assert result.status == "pass", f"Browser verification failed for Add Task: {result.reason}"

def test_browser_update_task(start_app, browser_verifier):
    run_id = open("/logs/artifacts/run-id").read().strip()
    task_text = f"Test Task for {run_id}"

    reason = "The user should be able to update a task's status."
    truth = f"Navigate to http://127.0.0.1:5173. Locate the task '{task_text}' in the list. Click its status toggle/button to change it from 'todo' to 'done'. Verify that the UI reflects the updated status (e.g., text strikethrough or status label change)."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_update_task"
    )
    assert result.status == "pass", f"Browser verification failed for Update Task: {result.reason}"

def test_browser_delete_task(start_app, browser_verifier):
    run_id = open("/logs/artifacts/run-id").read().strip()
    task_text = f"Test Task for {run_id}"

    reason = "The user should be able to delete a task."
    truth = f"Navigate to http://127.0.0.1:5173. Locate the delete button for the task '{task_text}'. Click the delete button. Verify that the task '{task_text}' is removed from the list."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_delete_task"
    )
    assert result.status == "pass", f"Browser verification failed for Delete Task: {result.reason}"

def test_schema_and_index_defined():
    """Verify that the schema defines runId, text, status, and the by_run_id_and_status index."""
    schema_path = os.path.join(PROJECT_DIR, "convex", "schema.ts")
    assert os.path.isfile(schema_path), f"Schema file not found at {schema_path}"

    with open(schema_path, "r") as f:
        content = f.read()

    assert "runId" in content, "Schema does not define 'runId'"
    assert "text" in content, "Schema does not define 'text'"
    assert "status" in content, "Schema does not define 'status'"
    assert "by_run_id_and_status" in content, "Schema does not define index 'by_run_id_and_status'"
    assert "[\"runId\",\"status\"]" in content.replace("'", "\"").replace(" ", ""), "Index 'by_run_id_and_status' does not cover ['runId', 'status']"
