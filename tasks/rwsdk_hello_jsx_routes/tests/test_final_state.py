import json
import os
import socket

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"
BASE_URL = "http://127.0.0.1:5173"


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


def test_ping_route(start_app):
    r = requests.get(f"{BASE_URL}/ping", timeout=30)
    assert r.status_code == 200, f"GET /ping returned {r.status_code}: {r.text[:300]}"
    assert "<h1>Pong!</h1>" in r.text, f"Expected '<h1>Pong!</h1>' in /ping HTML, got: {r.text[:500]}"


def test_about_route(start_app):
    r = requests.get(f"{BASE_URL}/about", timeout=30)
    assert r.status_code == 200, f"GET /about returned {r.status_code}: {r.text[:300]}"
    assert "About RedwoodSDK" in r.text, "Expected 'About RedwoodSDK' in /about HTML."
    assert "React framework for Cloudflare" in r.text, \
        "Expected 'React framework for Cloudflare' in /about HTML."


def test_status_route(start_app):
    r = requests.get(f"{BASE_URL}/status", timeout=30)
    assert r.status_code == 200, f"GET /status returned {r.status_code}: {r.text[:300]}"
    assert "application/json" in r.headers.get("content-type", "").lower(), \
        f"Expected JSON content-type, got: {r.headers.get('content-type')}"
    data = r.json()
    assert data == {"ok": True, "name": "rwsdk"}, f"Unexpected /status payload: {data}"


@pytest.mark.parametrize("name", ["world", "redwood"])
def test_greet_route(start_app, name):
    reason = (
        "Verify the RedwoodSDK app renders a dynamic greeting page that interpolates the "
        "URL path parameter into the visible page text."
    )
    truth = (
        f"Navigate to {BASE_URL}/greet/{name}. "
        f"Verify that the rendered page contains the visible text 'Hello, {name}!'."
    )
    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir=f"/logs/verifier/pochi/test_greet_route_{name}",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
