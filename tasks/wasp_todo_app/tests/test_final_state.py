import os
import socket
import pytest
import portpicker
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/todo-app"

@pytest.fixture(scope="module")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="module")
def start_app(xprocess, app_port):
    """
    Starts the wasp service using xprocess. Confirms readiness via port check.
    """

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["wasp", "start", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            """
            Custom check: returns True if the target port is accepting connections.
            """
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

def test_files_exist():
    required_files = [
        "main.wasp",
        "schema.prisma",
        "src/queries.ts",
        "src/actions.ts",
        "src/MainPage.tsx"
    ]
    for f in required_files:
        path = os.path.join(PROJECT_DIR, f)
        assert os.path.isfile(path), f"Required file {path} is missing."

def test_schema_definitions():
    schema_path = os.path.join(PROJECT_DIR, "schema.prisma")
    with open(schema_path, "r") as f:
        content = f.read()
    assert "model User" in content, "User model missing in schema.prisma"
    assert "model Task" in content, "Task model missing in schema.prisma"
    assert "description" in content and "String" in content, "Task.description field missing"
    assert "isDone" in content and "Boolean" in content, "Task.isDone field missing"

def test_main_wasp_config():
    wasp_path = os.path.join(PROJECT_DIR, "main.wasp")
    with open(wasp_path, "r") as f:
        content = f.read()
    assert "auth:" in content, "Auth configuration missing in main.wasp"
    assert "usernameAndPassword:" in content, "usernameAndPassword auth method missing"
    assert "query getTasks" in content, "getTasks query missing"
    assert "action createTask" in content, "createTask action missing"
    assert "action updateTask" in content, "updateTask action missing"
    assert "authRequired: true" in content, "MainPage should require authentication"

def test_operation_security():
    queries_path = os.path.join(PROJECT_DIR, "src/queries.ts")
    with open(queries_path, "r") as f:
        content = f.read()
    assert "context.user" in content, "Security check (context.user) missing in queries.ts"

    actions_path = os.path.join(PROJECT_DIR, "src/actions.ts")
    with open(actions_path, "r") as f:
        content = f.read()
    assert "context.user" in content, "Security check (context.user) missing in actions.ts"

def test_browser_verification(start_app, app_port):
    reason = "The Wasp Todo application should support multi-user authentication, task creation, and task toggling with data isolation."
    truth = (
        f"1. Navigate to http://localhost:{app_port}/signup. Create an account with username 'testuser' and password 'password123'. "
        f"2. Navigate to http://localhost:{app_port}/login. Login with the credentials created above. "
        f"3. On the main page, enter 'Buy milk' in the task description field and click 'Create task'. "
        f"4. Refresh the page. Verify that the task 'Buy milk' is still visible. "
        f"5. Click the checkbox next to 'Buy milk'. Verify that the state updates. "
        f"6. Logout and signup with a different user 'otheruser' and password 'password123'. "
        f"7. Verify that the task 'Buy milk' is NOT visible for 'otheruser'. "
        f"8. Click the 'Logout' button. Verify redirection to the login page."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
