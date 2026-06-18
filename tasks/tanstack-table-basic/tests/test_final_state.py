import os
import socket
import pytest
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
PORT = 3145

@pytest.fixture(scope="session")
def browser_verifier():
    yield PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """
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
                return s.connect_ex(("localhost", PORT)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_tanstack_table_basic(start_app, browser_verifier):
    reason = "The application should display a basic data grid using TanStack Table with static data."
    truth = (
        f"Navigate to http://localhost:{PORT}. "
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
