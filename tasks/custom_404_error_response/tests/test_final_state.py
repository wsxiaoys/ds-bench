import os
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"
BASE_URL = "http://localhost:5173"


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 5173)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()


def test_home(start_app):
    r = requests.get(f"{BASE_URL}/home", timeout=30)
    assert r.status_code == 200, f"GET /home returned {r.status_code}"
    assert "Welcome home" in r.text


def test_healthcheck(start_app):
    r = requests.get(f"{BASE_URL}/healthcheck", timeout=30)
    assert r.status_code == 200
    assert r.text.strip() == "ok"


@pytest.mark.parametrize("path", ["/does-not-exist", "/nope/whatever"])
def test_custom_404(start_app, path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert r.status_code == 404, f"GET {path} expected 404, got {r.status_code}: {r.text[:200]}"
    assert "Page Not Found" in r.text, f"404 body missing 'Page Not Found': {r.text[:300]}"
    assert "The page you requested could not be found." in r.text, \
        f"404 body missing detail message: {r.text[:300]}"


def test_error_response_route(start_app):
    r = requests.get(f"{BASE_URL}/boom", timeout=30)
    assert r.status_code == 418, f"GET /boom expected 418, got {r.status_code}: {r.text[:200]}"
    assert "Short and stout" in r.text, f"/boom body missing message: {r.text[:300]}"
