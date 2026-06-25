import os
import socket
import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"

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
    Starts the npm service using xprocess. Confirms readiness via port check.
    """
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

    # ensure() starts the process and blocks until startup_check is True
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

def test_tanstack_table_basic(start_app, app_port, browser_verifier):
    reason = "The application should display a basic data grid using TanStack Table with static data."
    truth = (
        f"Navigate to http://localhost:{app_port}. "
        "Verify that the page contains at least one `<table>` element. "
        "Verify that the table contains a `<thead>` element. "
        "Verify that the `<thead>` contains at least one `<tr>` with at least 3 `<th>` elements. "
        "Verify that the table contains a `<tbody>` element. "
        "Verify that the `<tbody>` contains at least 3 `<tr>` elements. "
        "Verify that each `<tr>` in the `<tbody>` contains `<td>` elements corresponding to the data."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_tanstack_table_basic"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
