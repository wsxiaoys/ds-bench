import pytest
import os
import socket
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def start_app(xprocess):
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
                return s.connect_ex(("localhost", 3000)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_create_single_article(start_app):
    url = "http://localhost:3000/articles"
    payload = {"title": "Hello World"}
    response = requests.post(url, json=payload)
    
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert "slug" in data, f"Expected 'slug' in response, got {data}"
    assert data["slug"] == "hello-world", f"Expected slug 'hello-world', got {data['slug']}"
    assert data["title"] == "Hello World", f"Expected title 'Hello World', got {data.get('title')}"

def test_create_bulk_articles(start_app):
    url = "http://localhost:3000/articles/bulk"
    payload = [{"title": "First Post"}, {"title": "Second Post"}]
    response = requests.post(url, json=payload)
    
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert isinstance(data, list), f"Expected response to be a list, got {type(data)}"
    assert len(data) == 2, f"Expected 2 articles created, got {len(data)}"
    
    slugs = [item.get("slug") for item in data]
    assert "first-post" in slugs, f"Expected 'first-post' in slugs, got {slugs}"
    assert "second-post" in slugs, f"Expected 'second-post' in slugs, got {slugs}"
