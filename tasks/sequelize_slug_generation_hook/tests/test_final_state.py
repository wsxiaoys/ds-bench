import pytest
import os
import socket
import requests
import portpicker
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()

@pytest.fixture(scope="session")
def start_app(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "start", "--", "--port", str(app_port)]
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

def test_create_single_article(start_app, app_port):
    url = f"http://localhost:{app_port}/articles"
    payload = {"title": "Hello World"}
    response = requests.post(url, json=payload)
    
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert "slug" in data, f"Expected 'slug' in response, got {data}"
    assert data["slug"] == "hello-world", f"Expected slug 'hello-world', got {data['slug']}"
    assert data["title"] == "Hello World", f"Expected title 'Hello World', got {data.get('title')}"

def test_create_bulk_articles(start_app, app_port):
    url = f"http://localhost:{app_port}/articles/bulk"
    payload = [{"title": "First Post"}, {"title": "Second Post"}]
    response = requests.post(url, json=payload)
    
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert isinstance(data, list), f"Expected response to be a list, got {type(data)}"
    assert len(data) == 2, f"Expected 2 articles created, got {len(data)}"
    
    slugs = [item.get("slug") for item in data]
    assert "first-post" in slugs, f"Expected 'first-post' in slugs, got {slugs}"
    assert "second-post" in slugs, f"Expected 'second-post' in slugs, got {slugs}"
