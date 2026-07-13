import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}"

SEED_SQL = (
    "DELETE FROM order_items; "
    "DELETE FROM orders; "
    "INSERT INTO orders (id, customer_name, status) "
    "VALUES (1, 'Ada Lovelace', 'paid'); "
    "INSERT INTO order_items (id, order_id, product_name, quantity, unit_price) "
    "VALUES (10, 1, 'Analytical Engine', 1, 100000), (11, 1, 'Punch Cards', 3, 500);"
)


def _run(cmd, timeout=240):
    return subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        input="y\n",
        timeout=timeout,
        env=os.environ.copy(),
    )


@pytest.fixture(scope="session")
def prepared_db():
    """Apply the generated migrations to the local D1 database and seed deterministic data."""
    migrate = _run(["npx", "wrangler", "d1", "migrations", "apply", "DB", "--local"])
    print("=== wrangler d1 migrations apply (stdout) ===")
    print(migrate.stdout)
    print("=== wrangler d1 migrations apply (stderr) ===")
    print(migrate.stderr)

    seed = _run(["npx", "wrangler", "d1", "execute", "DB", "--local", "--command", SEED_SQL])
    print("=== wrangler d1 execute seed (stdout) ===")
    print(seed.stdout)
    print("=== wrangler d1 execute seed (stderr) ===")
    print(seed.stderr)
    assert seed.returncode == 0, (
        "Failed to seed the local D1 database. The 'orders' and 'order_items' tables "
        f"must exist (via generated migrations). stderr: {seed.stderr}"
    )
    return True


@pytest.fixture(scope="session")
def start_app(xprocess, prepared_db):
    """Start the RedwoodSDK dev server and wait until it listens on the required port."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except FileNotFoundError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"===== [{tag}: Begin] {Starter.name} logfile =====")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===== [{tag}: End] {Starter.name} logfile =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _get_with_retries(path, retries=15, delay=2):
    last_exc = None
    for _ in range(retries):
        try:
            resp = requests.get(f"{BASE_URL}{path}", timeout=20)
            # The RSC dev server may still be warming up; retry on 5xx.
            if resp.status_code < 500:
                return resp
            last_exc = AssertionError(f"Got {resp.status_code} for {path}: {resp.text[:500]}")
        except requests.RequestException as exc:
            last_exc = exc
        time.sleep(delay)
    if last_exc:
        raise last_exc
    raise AssertionError(f"Could not reach {path}")


def test_get_order_with_nested_items(start_app):
    resp = _get_with_retries("/api/orders/1")
    assert resp.status_code == 200, (
        f"GET /api/orders/1 should return 200, got {resp.status_code}: {resp.text[:500]}"
    )
    content_type = resp.headers.get("content-type", "")
    assert "application/json" in content_type, (
        f"Response should be JSON (application/json), got Content-Type: {content_type!r}"
    )

    body = resp.json()
    assert body.get("id") == 1, f"Expected order id 1, got: {body.get('id')!r}"
    assert body.get("customerName") == "Ada Lovelace", (
        f"Expected customerName 'Ada Lovelace', got: {body.get('customerName')!r}"
    )
    assert body.get("status") == "paid", f"Expected status 'paid', got: {body.get('status')!r}"

    items = body.get("items")
    assert isinstance(items, list), f"Expected 'items' to be a list, got: {type(items)}"
    assert len(items) == 2, f"Expected 2 nested items, got {len(items)}: {items!r}"

    sorted_items = sorted(items, key=lambda it: it.get("id"))
    expected = [
        {"id": 10, "productName": "Analytical Engine", "quantity": 1, "unitPrice": 100000},
        {"id": 11, "productName": "Punch Cards", "quantity": 3, "unitPrice": 500},
    ]
    for actual, exp in zip(sorted_items, expected):
        for key, value in exp.items():
            assert actual.get(key) == value, (
                f"Item field '{key}' mismatch. Expected {value!r}, got {actual.get(key)!r} "
                f"in item {actual!r}"
            )


def test_get_missing_order_returns_404(start_app):
    resp = _get_with_retries("/api/orders/999999")
    assert resp.status_code == 404, (
        f"GET /api/orders/999999 should return 404, got {resp.status_code}: {resp.text[:500]}"
    )
    body = resp.json()
    assert isinstance(body.get("error"), str) and body.get("error"), (
        f"404 response body should contain a non-empty 'error' string, got: {body!r}"
    )
