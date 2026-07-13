import glob
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
USERS_URL = f"{BASE_URL}/api/users"


def _run(cmd, timeout=300):
    """Run a command in the project directory and return the CompletedProcess."""
    return subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=os.environ.copy(),
    )


@pytest.fixture(scope="session")
def prepare_db():
    """Reset local D1 state and apply Drizzle migrations to the local database."""
    # Start from a clean local database so 'total' counts are deterministic.
    state_dir = os.path.join(PROJECT_DIR, ".wrangler", "state")
    subprocess.run(["rm", "-rf", state_dir], check=False)

    # Generate migrations from the Drizzle schema if none are present yet.
    existing_migrations = glob.glob(
        os.path.join(PROJECT_DIR, "**", "*.sql"), recursive=True
    )
    if not existing_migrations:
        gen = _run(["npx", "drizzle-kit", "generate"])
        print("=== drizzle-kit generate stdout ===")
        print(gen.stdout)
        print("=== drizzle-kit generate stderr ===")
        print(gen.stderr)

    # Apply migrations to the LOCAL D1 database. Binding must be named 'DB'.
    apply = _run(
        ["npx", "wrangler", "d1", "migrations", "apply", "DB", "--local"]
    )
    print("=== wrangler d1 migrations apply stdout ===")
    print(apply.stdout)
    print("=== wrangler d1 migrations apply stderr ===")
    print(apply.stderr)
    assert apply.returncode == 0, (
        "Failed to apply local D1 migrations for binding 'DB'. "
        f"stdout={apply.stdout}\nstderr={apply.stderr}"
    )
    yield


@pytest.fixture(scope="session")
def start_app(prepare_db, xprocess):
    """Start the RedwoodSDK dev server and wait until port 5173 is accepting connections."""

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

    # The dev server may accept TCP connections before the worker can serve
    # requests (first request triggers a build). Poll until it responds.
    deadline = time.time() + 120
    last_err = None
    while time.time() < deadline:
        try:
            r = requests.get(USERS_URL, timeout=10)
            if r.status_code < 500:
                break
            last_err = f"status {r.status_code}: {r.text}"
        except requests.RequestException as e:
            last_err = str(e)
        time.sleep(2)
    else:
        capture_logs("NOT_READY")
        pytest.fail(f"Server did not become ready at {USERS_URL}: {last_err}")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def created_users(start_app):
    """Verify the initial empty state, then create five users in a fixed order."""
    # Step 1: empty list defaults.
    r = requests.get(USERS_URL, timeout=30)
    assert r.status_code == 200, f"GET /api/users expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("users") == [], f"Expected empty users list initially, got {body.get('users')}"
    assert body.get("total") == 0, f"Expected total 0 initially, got {body.get('total')}"
    assert body.get("limit") == 10, f"Expected default limit 10, got {body.get('limit')}"
    assert body.get("offset") == 0, f"Expected default offset 0, got {body.get('offset')}"

    # Step 2: create users in order.
    people = [
        ("Alice", "alice@example.com"),
        ("Bob", "bob@example.com"),
        ("Carol", "carol@example.com"),
        ("Dave", "dave@example.com"),
        ("Eve", "eve@example.com"),
    ]
    ids = []
    for name, email in people:
        resp = requests.post(USERS_URL, json={"name": name, "email": email}, timeout=30)
        assert resp.status_code == 201, (
            f"POST /api/users for {email} expected 201, got {resp.status_code}: {resp.text}"
        )
        created = resp.json()
        assert isinstance(created.get("id"), int), f"Created user id must be an integer, got {created.get('id')}"
        assert created.get("name") == name, f"Expected name {name}, got {created.get('name')}"
        assert created.get("email") == email, f"Expected email {email}, got {created.get('email')}"
        ids.append(created["id"])

    # ids must be monotonically increasing in insertion order.
    assert ids == sorted(ids) and len(set(ids)) == len(ids), (
        f"Expected strictly increasing unique ids in insertion order, got {ids}"
    )
    return ids


def _names(body):
    return [u.get("name") for u in body.get("users", [])]


def test_total_count_and_default_limit(created_users):
    r = requests.get(USERS_URL, timeout=30)
    assert r.status_code == 200, f"GET /api/users expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("total") == 5, f"Expected total 5, got {body.get('total')}"
    assert body.get("limit") == 10, f"Expected default limit 10, got {body.get('limit')}"
    assert body.get("offset") == 0, f"Expected default offset 0, got {body.get('offset')}"
    assert _names(body) == ["Alice", "Bob", "Carol", "Dave", "Eve"], (
        f"Expected all users ordered by id ascending, got {_names(body)}"
    )


def test_pagination_page_one(created_users):
    r = requests.get(USERS_URL, params={"limit": 2, "offset": 0}, timeout=30)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("total") == 5, f"Expected total 5, got {body.get('total')}"
    assert body.get("limit") == 2, f"Expected limit 2, got {body.get('limit')}"
    assert body.get("offset") == 0, f"Expected offset 0, got {body.get('offset')}"
    assert _names(body) == ["Alice", "Bob"], f"Expected first page [Alice, Bob], got {_names(body)}"


def test_pagination_page_two(created_users):
    r = requests.get(USERS_URL, params={"limit": 2, "offset": 2}, timeout=30)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("total") == 5, f"Expected total 5, got {body.get('total')}"
    assert body.get("limit") == 2, f"Expected limit 2, got {body.get('limit')}"
    assert body.get("offset") == 2, f"Expected offset 2, got {body.get('offset')}"
    assert _names(body) == ["Carol", "Dave"], f"Expected second page [Carol, Dave], got {_names(body)}"


def test_pagination_last_partial_page(created_users):
    r = requests.get(USERS_URL, params={"limit": 2, "offset": 4}, timeout=30)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("total") == 5, f"Expected total 5, got {body.get('total')}"
    assert body.get("limit") == 2, f"Expected limit 2, got {body.get('limit')}"
    assert body.get("offset") == 4, f"Expected offset 4, got {body.get('offset')}"
    assert _names(body) == ["Eve"], f"Expected last page [Eve], got {_names(body)}"


def test_offset_beyond_range(created_users):
    r = requests.get(USERS_URL, params={"limit": 2, "offset": 10}, timeout=30)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("total") == 5, f"Expected total 5, got {body.get('total')}"
    assert body.get("users") == [], f"Expected empty page beyond range, got {body.get('users')}"


def test_duplicate_email_conflict(created_users):
    resp = requests.post(
        USERS_URL, json={"name": "Alice2", "email": "alice@example.com"}, timeout=30
    )
    assert resp.status_code == 409, (
        f"POST with duplicate email expected 409, got {resp.status_code}: {resp.text}"
    )


def test_validation_errors(created_users):
    missing_name = requests.post(
        USERS_URL, json={"email": "noname@example.com"}, timeout=30
    )
    assert missing_name.status_code == 400, (
        f"POST without name expected 400, got {missing_name.status_code}: {missing_name.text}"
    )

    missing_email = requests.post(USERS_URL, json={"name": "NoEmail"}, timeout=30)
    assert missing_email.status_code == 400, (
        f"POST without email expected 400, got {missing_email.status_code}: {missing_email.text}"
    )

    # No invalid or duplicate request should have created a row.
    r = requests.get(USERS_URL, timeout=30)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.json().get("total") == 5, (
        f"Expected total to remain 5 after failed creates, got {r.json().get('total')}"
    )
