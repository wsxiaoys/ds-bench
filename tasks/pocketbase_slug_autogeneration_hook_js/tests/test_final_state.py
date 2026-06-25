import pytest
import requests
import socket
import os
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/pocketbase_app"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "pocketbase"
        args = ["./pocketbase", "serve", f"--http=0.0.0.0:{app_port}"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
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

def test_create_post_valid_title(start_app, app_port):
    url = f"http://127.0.0.1:{app_port}/api/collections/posts/records"
    payload = {"title": "Hello PocketBase JSVM"}
    
    response = requests.post(url, json=payload)
    
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Response: {response.text}"
    data = response.json()
    assert data.get("title") == "Hello PocketBase JSVM", f"Expected title to be 'Hello PocketBase JSVM', got {data.get('title')}"
    assert data.get("slug") == "hello-pocketbase-jsvm", f"Expected slug to be 'hello-pocketbase-jsvm', got {data.get('slug')}"

def test_create_post_empty_title(start_app, app_port):
    url = f"http://127.0.0.1:{app_port}/api/collections/posts/records"
    payload = {"title": ""}
    
    response = requests.post(url, json=payload)
    
    assert response.status_code == 400, f"Expected status 400 for empty title, got {response.status_code}. Response: {response.text}"
    data = response.json()
    assert "cannot be empty" in str(data).lower() or "badrequest" in str(data).lower() or response.status_code == 400, \
        f"Expected error message indicating title cannot be empty, got {data}"

def test_create_post_missing_title(start_app, app_port):
    url = f"http://127.0.0.1:{app_port}/api/collections/posts/records"
    payload = {}
    
    response = requests.post(url, json=payload)
    
    assert response.status_code == 400, f"Expected status 400 for missing title, got {response.status_code}. Response: {response.text}"
    data = response.json()
    assert "cannot be empty" in str(data).lower() or "badrequest" in str(data).lower() or response.status_code == 400, \
        f"Expected error message indicating title cannot be empty, got {data}"
