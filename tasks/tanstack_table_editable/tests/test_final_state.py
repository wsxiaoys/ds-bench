import pytest
import subprocess
import os
import socket
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
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

def test_inline_edit_table(start_app, app_port, browser_verifier):
    reason = "The application must display a data table with inline editing capabilities using TanStack Table and Form."
    truth = (
        f"Navigate to http://localhost:{app_port}. "
        "Verify that a table is rendered with columns ID, Name, Email, and Role. "
        "Verify that there are at least 3 rows of data. "
        "Verify that each row has an 'Edit' button. "
        "Click the 'Edit' button on the first row. "
        "Verify that the row switches to edit mode, displaying input fields for Name, Email, and Role. "
        "Verify that 'Save' and 'Cancel' buttons appear. "
        "Modify the Name input field. "
        "Click 'Cancel'. "
        "Verify that the row exits edit mode and the original Name is displayed. "
        "Click 'Edit' on the first row again. "
        "Clear the Name input field. "
        "Click 'Save'. "
        "Verify that an error message appears (e.g., indicating Name is required) and the row remains in edit mode. "
        "Enter a new valid Name (e.g., 'Updated User') and Email (e.g., 'updated@example.com'). "
        "Click 'Save'. "
        "Verify that the row exits edit mode and the new Name and Email are displayed in the table."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_inline_edit_table"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
