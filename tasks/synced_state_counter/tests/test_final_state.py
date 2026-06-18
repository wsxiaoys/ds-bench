import json
import os
import socket

import pytest
import requests
from pochi_verifier import PochiVerifier
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


def test_counter_route(start_app):
    r = requests.get(f"{BASE_URL}/counter", timeout=30)
    assert r.status_code == 200, f"GET /counter status {r.status_code}: {r.text[:200]}"
    assert "Count:" in r.text, f"Counter page missing 'Count:' marker: {r.text[:400]}"
    assert "Increment" in r.text, f"Increment button missing: {r.text[:400]}"


def test_browser_counter_flow(start_app):
    reason = (
        "Verify the RedwoodSDK realtime counter built on useSyncedState behaves like a "
        "stateful client component with persistent server-side state."
    )
    truth = (
        "Navigate to http://localhost:5173/counter. Locate the button labelled 'Reset' and click it. "
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
