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


def test_get_items(start_app):
    r = requests.get(f"{BASE_URL}/api/items", timeout=30)
    assert r.status_code == 200, f"GET /api/items returned {r.status_code}: {r.text[:200]}"
    assert r.json() == {"items": ["alpha", "beta", "gamma"]}, f"Unexpected body: {r.text[:300]}"


def test_head_items(start_app):
    r = requests.head(f"{BASE_URL}/api/items", timeout=30)
    assert r.status_code == 200, f"HEAD /api/items returned {r.status_code}"
    assert r.headers.get("X-Items-Count") == "3", \
        f"Expected X-Items-Count: 3, got {r.headers.get('X-Items-Count')}"
    assert r.text == "", "HEAD response must have empty body."


def test_post_items(start_app):
    r = requests.post(f"{BASE_URL}/api/items", timeout=30)
    assert r.status_code == 201, f"POST /api/items returned {r.status_code}: {r.text[:200]}"
    assert r.json() == {"created": True}, f"Unexpected POST body: {r.text[:200]}"


def test_delete_items(start_app):
    r = requests.delete(f"{BASE_URL}/api/items", timeout=30)
    assert r.status_code == 204, f"DELETE /api/items returned {r.status_code}: {r.text[:200]}"


def test_options_items(start_app):
    r = requests.options(f"{BASE_URL}/api/items", timeout=30)
    assert r.status_code == 204, f"OPTIONS /api/items returned {r.status_code}: {r.text[:200]}"
    allow = r.headers.get("Allow", "").upper()
    for m in ("GET", "HEAD", "POST", "DELETE"):
        assert m in allow, f"OPTIONS Allow header missing {m}: {allow!r}"


def test_unsupported_method_405(start_app):
    r = requests.put(f"{BASE_URL}/api/items", timeout=30)
    assert r.status_code == 405, f"PUT /api/items expected 405, got {r.status_code}"


def test_get_no_options(start_app):
    r = requests.get(f"{BASE_URL}/api/no-options", timeout=30)
    assert r.status_code == 200, f"GET /api/no-options returned {r.status_code}: {r.text[:200]}"
    assert r.text.strip() == "ok", f"Expected body 'ok', got {r.text!r}"


def test_options_no_options_returns_405(start_app):
    r = requests.options(f"{BASE_URL}/api/no-options", timeout=30)
    assert r.status_code == 405, f"OPTIONS /api/no-options expected 405, got {r.status_code}"
