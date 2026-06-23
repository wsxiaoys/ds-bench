import pytest
import subprocess
import os
import socket
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/tanstack-query-todo"
PORT = 4821
BASE_URL = f"http://localhost:{PORT}"

shared_state = {}

@pytest.fixture(scope="session", autouse=True)
def build_app():
    """Build the app if a build script exists."""
    subprocess.run(["npm", "run", "build"], cwd=PROJECT_DIR, capture_output=True)

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
        args = ["npm", "start"]
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

def test_api_create_todo(start_app):
    """Verify that we can create a todo via the API."""
    response = requests.post(f"{BASE_URL}/api/todos", json={"text": "Buy groceries"})
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    
    data = response.json()
    assert data.get("text") == "Buy groceries", f"Expected text 'Buy groceries', got {data.get('text')}"
    assert data.get("completed") is False, f"Expected completed False, got {data.get('completed')}"
    assert "id" in data, "Response should include an 'id'"
    
    shared_state["created_id"] = data["id"]

def test_api_list_todos(start_app):
    """Verify that we can list todos via the API."""
    created_id = shared_state.get("created_id")
    assert created_id is not None, "Previous test failed to create a todo or save its ID"

    response = requests.get(f"{BASE_URL}/api/todos")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    
    data = response.json()
    assert isinstance(data, list), "Expected response to be a JSON array"
    
    found = any(item.get("id") == created_id and item.get("text") == "Buy groceries" for item in data)
    assert found, f"Created todo with id {created_id} not found in the list of todos"

def test_frontend_todo_flow(start_app, browser_verifier):
    """Verify the frontend UI for displaying and creating todos."""
    reason = "The frontend must display the list of todos fetched from the API and allow creating new ones via TanStack Query without a page reload."
    truth = f"Navigate to {BASE_URL}. Wait for the page to load. Verify that there is an element with id='todo-list' containing an 'li' element with the text 'Buy groceries' (which was created via API). Then, type 'Walk the dog' into the input with id='todo-input'. Click the button with id='todo-submit'. Wait for the mutation to complete. Verify that the element with id='todo-list' now contains an 'li' element with the text 'Walk the dog'."

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_frontend_todo_flow"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
