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

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0  # track how many lines have already been printed

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
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


def test_ok(start_app):
    r = requests.get(f"{BASE_URL}/ok", timeout=30)
    assert r.status_code == 200
    assert "application/json" in r.headers.get("content-type", "").lower()
    assert r.json() == {"ok": True}


def test_err_known(start_app):
    r = requests.get(f"{BASE_URL}/err/known", timeout=30)
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:300]}"
    assert r.json() == {"error": "resource missing", "code": 404}


def test_err_teapot(start_app):
    r = requests.get(f"{BASE_URL}/err/teapot", timeout=30)
    assert r.status_code == 418
    assert r.json() == {"error": "teapot", "code": 418}


def test_err_boom(start_app):
    r = requests.get(f"{BASE_URL}/err/boom", timeout=30)
    assert r.status_code == 500, f"expected 500, got {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("error") == "internal", f"unexpected body: {body}"
    assert body.get("message") == "kaboom!", f"unexpected message: {body}"
