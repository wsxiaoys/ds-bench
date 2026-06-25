import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port


@pytest.fixture(scope="session")
def server(xprocess, app_port):
    """Start the Express server with `npx tsx server.ts` on dynamic port."""

    class Starter(ProcessStarter):
        name = "express_server"
        args = ["npx", "--no-install", "tsx", "server.ts", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            return _port_open("localhost", app_port)

    pid, logpath = xprocess.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")

    # Extra grace period for first-route warm-up.
    deadline = time.time() + 10
    base_url = f"http://localhost:{app_port}"
    while time.time() < deadline:
        try:
            requests.get(base_url + "/__warmup__", timeout=2)
            break
        except Exception:
            time.sleep(0.25)

    yield

    # teardown: print the logs and terminate the service
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile when teardown =============================")
        print(logs)
        print("===== End: Captured xprocess logfile when teardown =============================")

    info = xprocess.getinfo(Starter.name)
    info.terminate()


# ---------------------------------------------------------------------------
# Behavioural tests
# ---------------------------------------------------------------------------


def test_server_binds_to_port(server, app_port):
    """Verification step 9: server listens on dynamic port."""
    assert _port_open("localhost", app_port), (
        f"Expected the Express server to be listening on port {app_port}."
    )


def test_post_users_valid_returns_201(server, app_port):
    """Verification step 1: POST /users with a valid body returns 201 and echoes the user."""
    payload = {
        "username": "alice123",
        "email": "alice@example.com",
        "age": 30,
    }
    r = requests.post(f"http://localhost:{app_port}/users", json=payload, timeout=15)
    assert r.status_code == 201, (
        f"Expected 201 for valid /users body, got {r.status_code}. "
        f"body={r.text!r}"
    )
    data = r.json()
    assert data.get("username") == "alice123", (
        f"Expected echoed username 'alice123', got {data!r}"
    )
    assert data.get("email") == "alice@example.com", (
        f"Expected echoed email 'alice@example.com', got {data!r}"
    )
    assert data.get("age") == 30, (
        f"Expected echoed age 30 (number), got {data!r}"
    )


def test_post_users_invalid_email_returns_400(server, app_port):
    """Verification step 2: POST /users with invalid email returns 400 with issues JSON."""
    payload = {
        "username": "bob42",
        "email": "not-an-email",
        "age": 25,
    }
    r = requests.post(f"http://localhost:{app_port}/users", json=payload, timeout=15)
    assert r.status_code == 400, (
        f"Expected 400 for invalid email, got {r.status_code}. body={r.text!r}"
    )
    data = r.json()
    assert isinstance(data, dict) and "issues" in data, (
        f"Expected error JSON to contain an 'issues' field, got {data!r}"
    )
    issues = data["issues"]
    assert isinstance(issues, list) and len(issues) >= 1, (
        f"Expected 'issues' to be a non-empty list, got {issues!r}"
    )
    assert all(
        isinstance(issue, dict) and isinstance(issue.get("message"), str)
        for issue in issues
    ), f"Each issue must have a string 'message' field, got {issues!r}"


def test_post_users_invalid_username_returns_400(server, app_port):
    """Verification step 3: POST /users with too-short username returns 400."""
    payload = {"username": "ab", "email": "ab@example.com"}
    r = requests.post(f"http://localhost:{app_port}/users", json=payload, timeout=15)
    assert r.status_code == 400, (
        f"Expected 400 for too-short username, got {r.status_code}. "
        f"body={r.text!r}"
    )
    data = r.json()
    assert isinstance(data, dict) and isinstance(data.get("issues"), list), (
        f"Expected error JSON with an 'issues' list, got {data!r}"
    )
    assert len(data["issues"]) >= 1, (
        f"Expected at least one issue, got {data!r}"
    )


def test_get_search_valid_coerces_numbers(server, app_port):
    """Verification step 4: GET /search with valid query coerces page/limit to numbers."""
    r = requests.get(
        f"http://localhost:{app_port}/search",
        params={"q": "hi", "page": "2", "limit": "10"},
        timeout=15,
    )
    assert r.status_code == 200, (
        f"Expected 200 for valid /search query, got {r.status_code}. "
        f"body={r.text!r}"
    )
    data = r.json()
    assert data.get("q") == "hi", f"Expected q='hi', got {data!r}"
    assert data.get("page") == 2, (
        f"Expected coerced numeric page=2, got {data!r}"
    )
    assert data.get("limit") == 10, (
        f"Expected coerced numeric limit=10, got {data!r}"
    )
    # Strict type checks: page/limit must be numbers, not strings.
    assert isinstance(data.get("page"), int) and not isinstance(
        data.get("page"), bool
    ), f"Expected page to be a number after coercion, got {data!r}"
    assert isinstance(data.get("limit"), int) and not isinstance(
        data.get("limit"), bool
    ), f"Expected limit to be a number after coercion, got {data!r}"


def test_get_search_page_zero_rejected(server, app_port):
    """Verification step 5: GET /search?page=0 fails the >=1 constraint."""
    r = requests.get(
        f"http://localhost:{app_port}/search",
        params={"q": "hi", "page": "0", "limit": "10"},
        timeout=15,
    )
    assert r.status_code == 400, (
        f"Expected 400 for page=0, got {r.status_code}. body={r.text!r}"
    )
    data = r.json()
    assert isinstance(data, dict) and isinstance(data.get("issues"), list), (
        f"Expected error JSON with 'issues' list, got {data!r}"
    )
    assert len(data["issues"]) >= 1, (
        f"Expected at least one issue for page=0, got {data!r}"
    )


def test_get_search_non_numeric_page_rejected(server, app_port):
    """Verification step 6: GET /search with non-numeric page fails coercion."""
    r = requests.get(
        f"http://localhost:{app_port}/search",
        params={"q": "hi", "page": "abc", "limit": "10"},
        timeout=15,
    )
    assert r.status_code == 400, (
        f"Expected 400 for non-numeric page, got {r.status_code}. "
        f"body={r.text!r}"
    )
    data = r.json()
    assert isinstance(data, dict) and isinstance(data.get("issues"), list), (
        f"Expected error JSON with 'issues' list, got {data!r}"
    )
    assert len(data["issues"]) >= 1, (
        f"Expected at least one issue for non-numeric page, got {data!r}"
    )


def test_get_search_limit_above_max_rejected(server, app_port):
    """Verification step 7: GET /search with limit > 50 fails."""
    r = requests.get(
        f"http://localhost:{app_port}/search",
        params={"q": "hi", "page": "1", "limit": "999"},
        timeout=15,
    )
    assert r.status_code == 400, (
        f"Expected 400 for limit=999, got {r.status_code}. body={r.text!r}"
    )
    data = r.json()
    assert isinstance(data, dict) and isinstance(data.get("issues"), list), (
        f"Expected error JSON with 'issues' list, got {data!r}"
    )
    assert len(data["issues"]) >= 1, (
        f"Expected at least one issue for limit=999, got {data!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape check (Standard Schema interface used in middleware)
# ---------------------------------------------------------------------------


_TILDE_STANDARD_RE = re.compile(r"~standard")


def _iter_source_files(root: str):
    skip_dirs = {"node_modules", ".git", "dist", "build", ".next"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if fn.endswith((".ts", ".tsx", ".js", ".mjs", ".cjs")):
                yield os.path.join(dirpath, fn)


def test_middleware_references_standard_schema_property():
    """Verification step 8: at least one source file references the `~standard` property."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory missing: {PROJECT_DIR}"

    matched = []
    for path in _iter_source_files(PROJECT_DIR):
        try:
            with open(path, encoding="utf-8") as f:
                content = f.read()
        except (OSError, UnicodeDecodeError):
            continue
        if _TILDE_STANDARD_RE.search(content):
            matched.append(path)

    assert matched, (
        "Expected at least one project source file to reference the "
        "Standard Schema property `~standard` (the middleware must drive "
        "validation through `schema['~standard'].validate(...)`)."
    )
