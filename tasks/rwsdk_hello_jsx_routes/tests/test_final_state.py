import json
import os
import socket

import portpicker
import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"


@pytest.fixture(scope="session")
def app_port():
    """Finds a free port on localhost."""
    return portpicker.pick_unused_port()


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

    info = xprocess.getinfo(Starter.name)

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            logs = f.read()
            print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
            print(logs)
            print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
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
