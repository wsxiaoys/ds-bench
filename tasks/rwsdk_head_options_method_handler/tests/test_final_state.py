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
    """
    Starts the npm service using xprocess. Confirms readiness via port check.
    """

    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            """
            Custom check: returns True if the target port is accepting connections.
            xprocess calls this repeatedly until it returns True or times out.
            """
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


def test_get_items(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/api/items", timeout=30)
    assert r.status_code == 200, f"GET /api/items returned {r.status_code}: {r.text[:200]}"
    assert r.json() == {"items": ["alpha", "beta", "gamma"]}, f"Unexpected body: {r.text[:300]}"


def test_head_items(start_app, app_port):
    r = requests.head(f"http://localhost:{app_port}/api/items", timeout=30)
    assert r.status_code == 200, f"HEAD /api/items returned {r.status_code}"
    assert r.headers.get("X-Items-Count") == "3", \
        f"Expected X-Items-Count: 3, got {r.headers.get('X-Items-Count')}"
    assert r.text == "", "HEAD response must have empty body."


def test_post_items(start_app, app_port):
    r = requests.post(f"http://localhost:{app_port}/api/items", timeout=30)
    assert r.status_code == 201, f"POST /api/items returned {r.status_code}: {r.text[:200]}"
    assert r.json() == {"created": True}, f"Unexpected POST body: {r.text[:200]}"


def test_delete_items(start_app, app_port):
    r = requests.delete(f"http://localhost:{app_port}/api/items", timeout=30)
    assert r.status_code == 204, f"DELETE /api/items returned {r.status_code}: {r.text[:200]}"


def test_options_items(start_app, app_port):
    r = requests.options(f"http://localhost:{app_port}/api/items", timeout=30)
    assert r.status_code == 204, f"OPTIONS /api/items returned {r.status_code}: {r.text[:200]}"
    allow = r.headers.get("Allow", "").upper()
    for m in ("GET", "HEAD", "POST", "DELETE"):
        assert m in allow, f"OPTIONS Allow header missing {m}: {allow!r}"


def test_unsupported_method_405(start_app, app_port):
    r = requests.put(f"http://localhost:{app_port}/api/items", timeout=30)
    assert r.status_code == 405, f"PUT /api/items expected 405, got {r.status_code}"


def test_get_no_options(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/api/no-options", timeout=30)
    assert r.status_code == 200, f"GET /api/no-options returned {r.status_code}: {r.text[:200]}"
    assert r.text.strip() == "ok", f"Expected body 'ok', got {r.text!r}"


def test_options_no_options_returns_405(start_app, app_port):
    r = requests.options(f"http://localhost:{app_port}/api/no-options", timeout=30)
    assert r.status_code == 405, f"OPTIONS /api/no-options expected 405, got {r.status_code}"
