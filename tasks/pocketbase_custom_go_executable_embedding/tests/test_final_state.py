import os
import shutil
import pytest
import requests
import socket
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"


@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()


@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    """
    Starts the PocketBase service using xprocess. Confirms readiness via port check.
    """
    # Setup: Clean up existing data to ensure a fresh start
    pb_data_dir = os.path.join(PROJECT_DIR, "pb_data")
    if os.path.isdir(pb_data_dir):
        shutil.rmtree(pb_data_dir)
        
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["./server", "serve", f"--http=0.0.0.0:{app_port}"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 30
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", app_port)) == 0

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


def test_hook_with_empty_title(start_app, app_port):
    url = f"http://127.0.0.1:{app_port}/api/collections/posts/records"
    payload = {"content": "Test content without title"}
    response = requests.post(url, json=payload)
    
    assert response.status_code == 400, f"Expected status 400 for empty title, got {response.status_code}. Response: {response.text}"
    assert "Title cannot be empty" in response.text, f"Expected error message 'Title cannot be empty' not found in response: {response.text}"


def test_hook_with_valid_title(start_app, app_port):
    url = f"http://127.0.0.1:{app_port}/api/collections/posts/records"
    payload = {"title": "My Awesome Post", "content": "This is a test post."}
    response = requests.post(url, json=payload)
    
    assert response.status_code == 200, f"Expected status 200 for valid title, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert data.get("title") == "My Awesome Post", f"Expected title 'My Awesome Post', got {data.get('title')}"
    assert data.get("slug") == "my-awesome-post", f"Expected slug 'my-awesome-post', got {data.get('slug')}"
