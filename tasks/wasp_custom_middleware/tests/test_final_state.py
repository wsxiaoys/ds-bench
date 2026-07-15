import os
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/custom-middleware"
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); connecting via 127.0.0.1 avoids confusing hangs.
HOST = "127.0.0.1"
SERVER_PORT = 3001
BASE_URL = f"http://{HOST}:{SERVER_PORT}"
STATUS_URL = f"{BASE_URL}/api/status"
ECHO_URL = f"{BASE_URL}/api/echo"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the Wasp app with `wasp start` and wait for the Express server."""

    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        # CRITICAL: set `env` as a class attribute, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        # First `wasp start` triggers a full build; allow plenty of time.
        timeout = 600
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, SERVER_PORT)) != 0:
                    return False
            # The server port is open; confirm the API route actually responds.
            try:
                resp = requests.get(STATUS_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

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
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_status_endpoint_and_global_namespace_headers(start_app):
    """GET /api/status returns {status: ok} with global + namespace headers."""
    resp = requests.get(STATUS_URL, timeout=30)
    assert resp.status_code == 200, (
        f"Expected GET {STATUS_URL} to return 200, got {resp.status_code}. Body: {resp.text}"
    )
    try:
        body = resp.json()
    except ValueError:
        pytest.fail(f"Expected JSON body from {STATUS_URL}, got: {resp.text}")
    assert body.get("status") == "ok", (
        f"Expected body {{'status': 'ok'}} from {STATUS_URL}, got: {body}"
    )
    assert resp.headers.get("X-Global") == "enabled", (
        "Expected global middleware to set response header 'X-Global: enabled' on "
        f"/api/status; got headers: {dict(resp.headers)}"
    )
    assert resp.headers.get("X-Api-Namespace") == "v1", (
        "Expected the /api namespace middleware to set response header "
        f"'X-Api-Namespace: v1' on /api/status; got headers: {dict(resp.headers)}"
    )


def test_cors_extended_local_origin(start_app):
    """The extra local origin http://localhost:5000 must be allowed by CORS."""
    origin = "http://localhost:5000"
    resp = requests.get(STATUS_URL, headers={"Origin": origin}, timeout=30)
    assert resp.headers.get("Access-Control-Allow-Origin") == origin, (
        f"Expected CORS to allow origin '{origin}' (Access-Control-Allow-Origin header "
        f"echoing it); got headers: {dict(resp.headers)}"
    )


def test_cors_default_origin_preserved(start_app):
    """The default local client origin http://localhost:3000 must still work."""
    origin = "http://localhost:3000"
    resp = requests.get(STATUS_URL, headers={"Origin": origin}, timeout=30)
    assert resp.headers.get("Access-Control-Allow-Origin") == origin, (
        f"Expected the default client origin '{origin}' to remain allowed after "
        f"extending the CORS origins; got headers: {dict(resp.headers)}"
    )


def test_echo_raw_body_and_per_api_middleware(start_app):
    """POST /api/echo parses raw bytes and applies its per-api middleware."""
    payload = b"hello"  # exactly 5 bytes
    resp = requests.post(
        ECHO_URL,
        data=payload,
        headers={"Content-Type": "application/octet-stream"},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Expected POST {ECHO_URL} to return 200, got {resp.status_code}. Body: {resp.text}"
    )
    try:
        body = resp.json()
    except ValueError:
        pytest.fail(f"Expected JSON body from {ECHO_URL}, got: {resp.text}")
    assert body.get("bytes") == 5, (
        "Expected the raw body parser to yield a body of 5 bytes for payload 'hello' "
        f"(response {{'bytes': 5}}), got: {body}"
    )
    assert resp.headers.get("X-Echo") == "raw", (
        "Expected the per-api middleware on /api/echo to set response header "
        f"'X-Echo: raw'; got headers: {dict(resp.headers)}"
    )
    assert resp.headers.get("X-Api-Namespace") == "v1", (
        "Expected the /api namespace middleware to also apply to /api/echo "
        f"('X-Api-Namespace: v1'); got headers: {dict(resp.headers)}"
    )


def test_per_api_middleware_is_isolated(start_app):
    """The echo route's middleware must not leak onto other /api routes."""
    resp = requests.get(STATUS_URL, timeout=30)
    assert "X-Echo" not in resp.headers, (
        "The 'X-Echo' header must only be set by the /api/echo route's middleware, "
        f"but it appeared on /api/status; got headers: {dict(resp.headers)}"
    )
