import pytest
import requests
import os
import socket
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the express service using xprocess. Confirms readiness via port check.
    """
    # ensure dependencies are installed
    import subprocess
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["node", "index.js", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 30
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

def test_cascading_soft_deletes(start_app, app_port):
    base_url = f"http://localhost:{app_port}"
    # 1. Create User
    res = requests.post(f"{base_url}/users", json={"username": "alice"})
    assert res.status_code == 201, f"Failed to create user: {res.text}"
    user = res.json()
    assert "username" in user and user["username"] == "alice", "User response missing or incorrect username"
    assert "id" in user, "User response missing id"
    user_id = user["id"]

    # 2. Create Post
    res = requests.post(f"{base_url}/users/{user_id}/posts", json={"title": "Hello World"})
    assert res.status_code == 201, f"Failed to create post: {res.text}"
    post = res.json()
    assert "title" in post and post["title"] == "Hello World", "Post response missing or incorrect title"
    assert "id" in post, "Post response missing id"
    post_id = post["id"]

    # 3. Verify Post Exists
    res = requests.get(f"{base_url}/posts/{post_id}")
    assert res.status_code == 200, f"Expected post to exist, got {res.status_code}: {res.text}"

    # 4. Soft Delete User
    res = requests.delete(f"{base_url}/users/{user_id}")
    assert res.status_code == 200, f"Failed to delete user: {res.text}"

    # 5. Verify Post is Soft-Deleted
    res = requests.get(f"{base_url}/posts/{post_id}")
    assert res.status_code == 404, f"Expected post to be soft-deleted (404), got {res.status_code}"

    # 6. Restore User
    res = requests.post(f"{base_url}/users/{user_id}/restore")
    assert res.status_code == 200, f"Failed to restore user: {res.text}"

    # 7. Verify Post is Restored
    res = requests.get(f"{base_url}/posts/{post_id}")
    assert res.status_code == 200, f"Expected post to be restored, got {res.status_code}: {res.text}"
