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


def test_ok(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/ok", timeout=30)
    assert r.status_code == 200
    assert "application/json" in r.headers.get("content-type", "").lower()
    assert r.json() == {"ok": True}


def test_err_known(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/err/known", timeout=30)
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:300]}"
    assert r.json() == {"error": "resource missing", "code": 404}


def test_err_teapot(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/err/teapot", timeout=30)
    assert r.status_code == 418
    assert r.json() == {"error": "teapot", "code": 418}


def test_err_boom(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/err/boom", timeout=30)
    assert r.status_code == 500, f"expected 500, got {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("error") == "internal", f"unexpected body: {body}"
    assert body.get("message") == "kaboom!", f"unexpected message: {body}"
