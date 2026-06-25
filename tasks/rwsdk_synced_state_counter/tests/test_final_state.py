import json
import os
import socket

import portpicker
import pytest
import requests
from pochi_verifier import PochiVerifier
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


def _strip_jsonc(text: str) -> str:
    out = []
    i = 0
    while i < len(text):
        c = text[i]
        if c == "/" and i + 1 < len(text) and text[i + 1] == "/":
            j = text.find("\n", i)
            i = j if j != -1 else len(text)
        elif c == "/" and i + 1 < len(text) and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = (j + 2) if j != -1 else len(text)
        else:
            out.append(c)
            i += 1
    return "".join(out)


def test_wrangler_bindings(start_app):
    path = "/home/user/myapp/wrangler.jsonc"
    assert os.path.isfile(path), f"Missing {path}"
    with open(path) as f:
        raw = f.read()
    cfg = json.loads(_strip_jsonc(raw))
    bindings = cfg.get("durable_objects", {}).get("bindings", [])
    matches = [b for b in bindings if b.get("name") == "SYNCED_STATE_SERVER"
               and b.get("class_name") == "SyncedStateServer"]
    assert matches, f"SYNCED_STATE_SERVER durable object binding missing: {bindings}"

    migrations = cfg.get("migrations", [])
    found = any(
        "SyncedStateServer" in (m.get("new_sqlite_classes") or [])
        for m in migrations
    )
    assert found, f"SyncedStateServer SQLite migration missing: {migrations}"


def test_counter_route(start_app, app_port):
    r = requests.get(f"http://localhost:{app_port}/counter", timeout=30)
    assert r.status_code == 200, f"GET /counter status {r.status_code}: {r.text[:200]}"
    assert "Count:" in r.text, f"Counter page missing 'Count:' marker: {r.text[:400]}"
    assert "Increment" in r.text, f"Increment button missing: {r.text[:400]}"


def test_browser_counter_flow(start_app, app_port):
    reason = (
        "Verify the RedwoodSDK realtime counter built on useSyncedState behaves like a "
        "stateful client component with persistent server-side state."
    )
    truth = (
        f"Navigate to http://localhost:{app_port}/counter. Locate the button labelled 'Reset' and click it. "
        "Verify the visible text shows 'Count: 0'. Then locate the button labelled 'Increment' and click it three times. "
        "Verify the visible text shows 'Count: 3'. Click the 'Reset' button again. "
        "Verify the visible text now shows 'Count: 0'."
    )
    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_counter_flow",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
