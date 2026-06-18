import json
import os
import re
import signal
import socket
import subprocess
import time

import pytest
import requests

PROJECT_DIR = "/home/user/myproject"
PORT = 47329
BASE_URL = f"http://127.0.0.1:{PORT}"
COUNTER_URL = f"{BASE_URL}/api/counter"
INCREMENT_URL = f"{BASE_URL}/api/counter/increment"
ROOT_URL = f"{BASE_URL}/"

START_TIMEOUT_SECONDS = 240
SHUTDOWN_TIMEOUT_SECONDS = 30


def _port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        try:
            s.connect((host, port))
            return True
        except OSError:
            return False


def _wait_for_port_open(host: str, port: int, timeout_s: int) -> None:
    deadline = time.time() + timeout_s
    last_err = None
    while time.time() < deadline:
        if _port_open(host, port, timeout=0.5):
            # also wait until HTTP responds, not just TCP accept
            try:
                r = requests.get(f"http://{host}:{port}/api/counter", timeout=2)
                if r.status_code < 500:
                    return
            except requests.RequestException as exc:
                last_err = exc
        time.sleep(0.5)
    raise TimeoutError(
        f"Port {host}:{port} did not become reachable within {timeout_s}s "
        f"(last_err={last_err})"
    )


def _wait_for_port_close(host: str, port: int, timeout_s: int) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if not _port_open(host, port, timeout=0.5):
            return
        time.sleep(0.3)
    raise TimeoutError(
        f"Port {host}:{port} was still in use after {timeout_s}s"
    )


def _pick_start_command() -> list[str]:
    pkg_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_json_path), (
        f"package.json not found at {pkg_json_path} — project was not scaffolded."
    )
    with open(pkg_json_path) as f:
        pkg = json.load(f)
    scripts = pkg.get("scripts", {})
    if "start" in scripts:
        return ["npm", "run", "start"]
    if "dev" in scripts:
        return ["npm", "run", "dev"]
    pytest.fail(
        "Neither 'start' nor 'dev' npm script is defined in package.json; "
        "cannot launch the application."
    )


def _spawn_server() -> subprocess.Popen:
    env = os.environ.copy()
    env.setdefault("PORT", str(PORT))
    env.setdefault("HOST", "0.0.0.0")
    env.setdefault("NODE_ENV", "production")
    cmd = _pick_start_command()
    # Use a process group so we can terminate child workers reliably.
    proc = subprocess.Popen(
        cmd,
        cwd=PROJECT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    try:
        _wait_for_port_open("127.0.0.1", PORT, START_TIMEOUT_SECONDS)
    except Exception:
        _terminate_server(proc)
        raise
    return proc


def _terminate_server(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        proc.terminate()
    try:
        proc.wait(timeout=15)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            proc.kill()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            pass
    try:
        _wait_for_port_close("127.0.0.1", PORT, SHUTDOWN_TIMEOUT_SECONDS)
    except TimeoutError:
        pass


def _ensure_dependencies_installed() -> None:
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    if os.path.isdir(node_modules):
        return
    result = subprocess.run(
        ["npm", "install", "--no-audit", "--no-fund"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert result.returncode == 0, (
        f"npm install failed: stdout={result.stdout}\nstderr={result.stderr}"
    )


def _maybe_build() -> None:
    pkg_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_json_path) as f:
        pkg = json.load(f)
    scripts = pkg.get("scripts", {})
    if "build" not in scripts or "start" not in scripts:
        return  # we'll fall back to `npm run dev`, no build required.
    # If `start` exists, do a fresh build to ensure latest source is compiled.
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert result.returncode == 0, (
        f"npm run build failed: stdout={result.stdout}\nstderr={result.stderr}"
    )


def _extract_count_from_html(body: str) -> int:
    """
    Heuristic: locate the counter value rendered in the SSR HTML.
    We need the count to appear as a literal integer somewhere in the body.
    We try, in order:
      1. The numeric value returned by /api/counter at the time of the request.
      2. Any small non-negative integer in the body, used only as a fallback.
    """
    return -1  # not used; the SSR test cross-checks against the JSON API.


@pytest.fixture(scope="module")
def first_run():
    _ensure_dependencies_installed()
    _maybe_build()
    proc = _spawn_server()
    yield proc
    _terminate_server(proc)


def test_node_available_runtime():
    import shutil
    assert shutil.which("node") is not None, "node not on PATH at verification time."


def test_get_counter_returns_json(first_run):
    r = requests.get(COUNTER_URL, timeout=10)
    assert r.status_code == 200, (
        f"GET {COUNTER_URL} expected 200, got {r.status_code}; body={r.text!r}"
    )
    assert "application/json" in r.headers.get("Content-Type", ""), (
        f"GET {COUNTER_URL} Content-Type must contain application/json, got "
        f"{r.headers.get('Content-Type')!r}"
    )
    payload = r.json()
    assert isinstance(payload, dict), f"GET {COUNTER_URL} body is not a JSON object: {payload!r}"
    assert "count" in payload, f"GET {COUNTER_URL} JSON missing 'count' field: {payload!r}"
    assert isinstance(payload["count"], int), (
        f"GET {COUNTER_URL} 'count' must be an integer, got {payload['count']!r}"
    )
    assert payload["count"] >= 0, f"Initial counter must be >= 0, got {payload['count']}"


def test_root_ssr_contains_count(first_run):
    api = requests.get(COUNTER_URL, timeout=10).json()
    c = api["count"]
    r = requests.get(ROOT_URL, timeout=15)
    assert r.status_code == 200, f"GET {ROOT_URL} expected 200, got {r.status_code}"
    ctype = r.headers.get("Content-Type", "")
    assert "text/html" in ctype, (
        f"GET {ROOT_URL} Content-Type must contain text/html, got {ctype!r}"
    )
    body = r.text
    # The literal counter value must appear in the server-rendered HTML.
    # Use a word-boundary regex so '0' matches '0' but not '10'.
    pattern = re.compile(rf"(?<!\d){re.escape(str(c))}(?!\d)")
    assert pattern.search(body) is not None, (
        f"SSR HTML at {ROOT_URL} does not contain the current counter value "
        f"{c} as a standalone number. First 1000 chars of body: {body[:1000]!r}"
    )


def test_increment_increases_count(first_run):
    before = requests.get(COUNTER_URL, timeout=10).json()["count"]

    r1 = requests.post(INCREMENT_URL, timeout=15)
    assert r1.status_code == 200, (
        f"POST {INCREMENT_URL} expected 200, got {r1.status_code}; body={r1.text!r}"
    )
    assert "application/json" in r1.headers.get("Content-Type", ""), (
        f"POST {INCREMENT_URL} Content-Type must contain application/json, got "
        f"{r1.headers.get('Content-Type')!r}"
    )
    body1 = r1.json()
    assert isinstance(body1, dict) and "count" in body1, (
        f"POST {INCREMENT_URL} body must be JSON with 'count', got {body1!r}"
    )
    assert body1["count"] == before + 1, (
        f"POST {INCREMENT_URL} should return count={before + 1}, got {body1['count']}"
    )

    after_get = requests.get(COUNTER_URL, timeout=10).json()
    assert after_get["count"] == before + 1, (
        f"GET {COUNTER_URL} after one increment expected {before + 1}, "
        f"got {after_get['count']}"
    )

    r2 = requests.post(INCREMENT_URL, timeout=15)
    assert r2.status_code == 200, (
        f"POST {INCREMENT_URL} (2nd) expected 200, got {r2.status_code}; body={r2.text!r}"
    )
    body2 = r2.json()
    assert body2["count"] == before + 2, (
        f"POST {INCREMENT_URL} (2nd) should return count={before + 2}, "
        f"got {body2['count']}"
    )

    final_get = requests.get(COUNTER_URL, timeout=10).json()
    assert final_get["count"] == before + 2, (
        f"GET {COUNTER_URL} after two increments expected {before + 2}, "
        f"got {final_get['count']}"
    )


def test_root_ssr_reflects_updated_count(first_run):
    api = requests.get(COUNTER_URL, timeout=10).json()
    c = api["count"]
    r = requests.get(ROOT_URL, timeout=15)
    assert r.status_code == 200, f"GET {ROOT_URL} expected 200, got {r.status_code}"
    pattern = re.compile(rf"(?<!\d){re.escape(str(c))}(?!\d)")
    assert pattern.search(r.text) is not None, (
        f"After increments, SSR HTML at {ROOT_URL} does not contain updated "
        f"counter value {c}. First 1000 chars: {r.text[:1000]!r}"
    )


def test_persistence_across_restart(first_run):
    # Capture current count, then bounce the server.
    value_before = requests.get(COUNTER_URL, timeout=10).json()["count"]

    _terminate_server(first_run)
    # Confirm the port is fully released before relaunching.
    _wait_for_port_close("127.0.0.1", PORT, SHUTDOWN_TIMEOUT_SECONDS)

    proc2 = _spawn_server()
    try:
        value_after = requests.get(COUNTER_URL, timeout=10).json()["count"]
        assert value_after == value_before, (
            f"Counter value did not persist across restart: "
            f"before={value_before}, after={value_after}"
        )
    finally:
        _terminate_server(proc2)


def test_sqlite_database_file_exists():
    found = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if ".git" in dirs:
            dirs.remove(".git")
        for fname in files:
            lower = fname.lower()
            if (
                lower.endswith(".db")
                or lower.endswith(".sqlite")
                or lower.endswith(".sqlite3")
            ):
                found.append(os.path.join(root, fname))
    assert found, (
        "Expected at least one SQLite database file (*.db / *.sqlite / *.sqlite3) "
        f"to exist inside {PROJECT_DIR} after the server has run, but found none."
    )
