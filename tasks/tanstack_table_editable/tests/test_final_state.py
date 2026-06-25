import pytest
import subprocess
import os
import socket
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

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
