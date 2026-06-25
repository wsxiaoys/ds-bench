import pytest
import os
import socket
import requests
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
