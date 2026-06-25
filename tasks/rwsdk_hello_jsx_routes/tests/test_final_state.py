import json
import os
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"


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
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", app_port)) == 0

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


def test_ping_route(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/ping", timeout=30)
    assert r.status_code == 200, f"GET /ping returned {r.status_code}: {r.text[:300]}"
    assert "<h1>Pong!</h1>" in r.text, f"Expected '<h1>Pong!</h1>' in /ping HTML, got: {r.text[:500]}"


def test_about_route(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/about", timeout=30)
    assert r.status_code == 200, f"GET /about returned {r.status_code}: {r.text[:300]}"
    assert "About RedwoodSDK" in r.text, "Expected 'About RedwoodSDK' in /about HTML."
    assert "React framework for Cloudflare" in r.text, \
        "Expected 'React framework for Cloudflare' in /about HTML."


def test_status_route(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/status", timeout=30)
    assert r.status_code == 200, f"GET /status returned {r.status_code}: {r.text[:300]}"
    assert "application/json" in r.headers.get("content-type", "").lower(), \
        f"Expected JSON content-type, got: {r.headers.get('content-type')}"
    data = r.json()
    assert data == {"ok": True, "name": "rwsdk"}, f"Unexpected /status payload: {data}"


@pytest.mark.parametrize("name", ["world", "redwood"])
def test_greet_route(start_app, app_port, name):
    r = requests.get(f"http://localhost:{app_port}/greet/{name}", timeout=30)
    assert r.status_code == 200, f"GET /greet/{name} returned {r.status_code}: {r.text[:300]}"
    assert f"Hello, {name}!" in r.text, \
        f"Expected 'Hello, {name}!' in /greet/{name} HTML, got: {r.text[:500]}"
