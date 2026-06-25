import os
import socket

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"


@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port


@pytest.fixture(scope="session")
def base_url(app_port):
    return f"http://localhost:{app_port}"


@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """

    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", app_port)) == 0

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


@pytest.fixture()
def reset_state(start_app, base_url):
    r = requests.post(f"{base_url}/todos.reset", timeout=30)
    assert r.status_code == 200 and r.text.strip() == "reset", \
        f"reset endpoint failed: {r.status_code} {r.text!r}"
    yield


def test_initial_empty(reset_state, base_url):
    r = requests.get(f"{base_url}/todos.json", timeout=30)
    assert r.status_code == 200
    assert r.json() == {"todos": []}


def test_todos_page_renders_form(reset_state, base_url):
    r = requests.get(f"{base_url}/todos", timeout=30)
    assert r.status_code == 200, f"GET /todos {r.status_code}: {r.text[:200]}"
    assert "Add Todo" in r.text, "Submit button label missing"
    assert 'name="title"' in r.text, "title input missing"


def test_browser_add_and_delete(reset_state, base_url, app_port):
    reason = (
        "Verify the RedwoodSDK Todo app supports adding and deleting todos via the rendered form, "
        "with state surviving page rehydration through serverAction wrappers."
    )
    truth = (
        f"Navigate to http://localhost:{app_port}/todos. Find the input element with name=\"title\". "
        "Type 'Buy milk' into the input and submit the form by clicking the button labelled 'Add Todo'. "
        "After submission verify that the rendered page contains an element with the visible text 'Buy milk' "
        "inside an element that has the attribute data-testid=\"todo-item\". "
        "Next, locate the 'Delete' button placed next to the 'Buy milk' row and click it. "
        "Verify that 'Buy milk' is no longer present on the page."
    )
    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_add_and_delete",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    # After the flow the in-memory list should be empty again
    rfinal = requests.get(f"{base_url}/todos.json", timeout=30)
    assert rfinal.status_code == 200
    assert rfinal.json() == {"todos": []}, f"Final list not empty: {rfinal.json()}"
