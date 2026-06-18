import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
BASE_URL = "http://localhost:5173"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Start the rwsdk dev server via `npm run dev`. Confirm readiness by
    probing the configured port until it accepts TCP connections.
    """

    class Starter(ProcessStarter):
        name = "start_rwsdk_app"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex(("localhost", 5173)) != 0:
                    return False
            # Also wait until the app responds to an HTTP request.
            try:
                r = requests.get(f"{BASE_URL}/api/sessions/count", timeout=5)
                return r.status_code in (200, 404, 500)
            except requests.RequestException:
                return False

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SESSION_ID_RE = re.compile(r"^[0-9a-f]{32}$")


def _set_cookie_headers(resp):
    """
    Return a list of Set-Cookie header values from a `requests.Response`,
    preserving every Set-Cookie line even when multiple are present.
    """
    raw = resp.raw.headers.get_all("Set-Cookie") if hasattr(resp.raw, "headers") else None
    if raw:
        return list(raw)
    # Fallback to single header
    sc = resp.headers.get("Set-Cookie")
    return [sc] if sc else []


def _find_sid_set_cookie(resp):
    for sc in _set_cookie_headers(resp):
        if sc.lower().startswith("sid="):
            return sc
    return None


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_wrangler_declares_sessions_kv_binding(start_app):
    wrangler_path = os.path.join(PROJECT_DIR, "wrangler.jsonc")
    assert os.path.isfile(wrangler_path), (
        f"wrangler.jsonc not found at {wrangler_path}; expected a KV binding declaration."
    )
    with open(wrangler_path) as f:
        content = f.read()
    # Strip common JSONC comments so regex can match across formatting variants.
    content_no_line_comments = re.sub(r"//[^\n]*", "", content)
    content_no_comments = re.sub(r"/\*.*?\*/", "", content_no_line_comments, flags=re.S)
    assert re.search(r'"binding"\s*:\s*"SESSIONS"', content_no_comments), (
        "Expected a KV binding with \"binding\": \"SESSIONS\" in wrangler.jsonc."
    )


def test_initial_count_is_zero(start_app):
    r = requests.get(f"{BASE_URL}/api/sessions/count", timeout=10)
    assert r.status_code == 200, f"Expected 200 from /api/sessions/count, got {r.status_code}: {r.text}"
    body = r.json()
    assert body == {"count": 0}, f"Expected initial count {{'count': 0}}, got {body}"


def test_unauthenticated_me_returns_401(start_app):
    r = requests.get(f"{BASE_URL}/api/sessions/me", timeout=10)
    assert r.status_code == 401, (
        f"Expected 401 for unauthenticated GET /api/sessions/me, got {r.status_code}: {r.text}"
    )


def test_full_session_lifecycle(start_app):
    # ---- Step 4: create alice's session ----
    alice = requests.Session()
    now_before = int(time.time())
    r = alice.post(
        f"{BASE_URL}/api/sessions",
        json={"userId": "alice"},
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    now_after = int(time.time())
    assert r.status_code == 201, (
        f"Expected 201 from POST /api/sessions, got {r.status_code}: {r.text}"
    )
    ct = r.headers.get("Content-Type", "")
    assert ct.lower().startswith("application/json"), (
        f"Expected JSON Content-Type from POST /api/sessions, got {ct!r}"
    )
    body = r.json()
    assert "sessionId" in body and "expiresAt" in body, (
        f"POST /api/sessions response missing required keys; got {body}"
    )
    sid_alice = body["sessionId"]
    expires_at_alice = body["expiresAt"]
    assert isinstance(sid_alice, str) and SESSION_ID_RE.match(sid_alice), (
        f"sessionId {sid_alice!r} does not match ^[0-9a-f]{{32}}$"
    )
    assert isinstance(expires_at_alice, (int, float)), (
        f"expiresAt must be a number, got {type(expires_at_alice).__name__}"
    )
    assert now_before + 3540 <= expires_at_alice <= now_after + 3660, (
        f"expiresAt {expires_at_alice} is not within ~3600s of now "
        f"({now_before}..{now_after}); expected approximately now + 3600."
    )

    sid_cookie_header = _find_sid_set_cookie(r)
    assert sid_cookie_header is not None, (
        "POST /api/sessions did not set a `sid` cookie via Set-Cookie."
    )
    lower_sc = sid_cookie_header.lower()
    assert f"sid={sid_alice}" in sid_cookie_header, (
        f"Set-Cookie does not bind sid to the returned sessionId; got {sid_cookie_header!r}"
    )
    assert "httponly" in lower_sc, (
        f"Set-Cookie for sid must include HttpOnly; got {sid_cookie_header!r}"
    )
    assert "path=/" in lower_sc, (
        f"Set-Cookie for sid must include Path=/; got {sid_cookie_header!r}"
    )
    assert "max-age=3600" in lower_sc, (
        f"Set-Cookie for sid must include Max-Age=3600; got {sid_cookie_header!r}"
    )

    # ---- Step 5: read /api/sessions/me using the session's cookie jar ----
    r = alice.get(f"{BASE_URL}/api/sessions/me", timeout=10)
    assert r.status_code == 200, (
        f"Expected 200 from GET /api/sessions/me with valid cookie, got {r.status_code}: {r.text}"
    )
    body = r.json()
    for key in ("userId", "createdAt", "expiresAt"):
        assert key in body, f"GET /api/sessions/me response missing key {key!r}; got {body}"
    assert body["userId"] == "alice", (
        f"Expected userId 'alice' in /api/sessions/me, got {body['userId']!r}"
    )
    assert abs(int(body["expiresAt"]) - int(expires_at_alice)) <= 2, (
        f"GET /me expiresAt {body['expiresAt']} differs from POST expiresAt {expires_at_alice}"
    )
    assert abs(int(body["createdAt"]) + 3600 - int(body["expiresAt"])) <= 2, (
        "Expected createdAt + 3600 == expiresAt (±2s); "
        f"got createdAt={body['createdAt']}, expiresAt={body['expiresAt']}"
    )

    # ---- Step 6: count should now be 1 ----
    r = requests.get(f"{BASE_URL}/api/sessions/count", timeout=10)
    assert r.status_code == 200, (
        f"Expected 200 from /api/sessions/count, got {r.status_code}: {r.text}"
    )
    assert r.json() == {"count": 1}, f"Expected count 1 after one POST, got {r.json()}"

    # ---- Step 7: create bob's session in a fresh requests.Session ----
    bob = requests.Session()
    r = bob.post(
        f"{BASE_URL}/api/sessions",
        json={"userId": "bob"},
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    assert r.status_code == 201, (
        f"Expected 201 from POST /api/sessions for bob, got {r.status_code}: {r.text}"
    )
    body = r.json()
    sid_bob = body["sessionId"]
    assert SESSION_ID_RE.match(sid_bob), (
        f"bob sessionId {sid_bob!r} does not match ^[0-9a-f]{{32}}$"
    )
    assert sid_bob != sid_alice, (
        "Expected a different sessionId for bob; got the same value as alice."
    )

    r = requests.get(f"{BASE_URL}/api/sessions/count", timeout=10)
    assert r.status_code == 200
    assert r.json() == {"count": 2}, f"Expected count 2 after two POSTs, got {r.json()}"

    # ---- Step 8: tampered/unknown sid returns 401 ----
    bogus_sid = "deadbeefdeadbeefdeadbeefdeadbeef"
    r = requests.get(
        f"{BASE_URL}/api/sessions/me",
        headers={"Cookie": f"sid={bogus_sid}"},
        timeout=10,
    )
    assert r.status_code == 401, (
        f"Expected 401 with unknown sid cookie, got {r.status_code}: {r.text}"
    )

    # ---- Step 9: delete alice's session ----
    r = alice.delete(f"{BASE_URL}/api/sessions/me", timeout=10)
    assert r.status_code == 204, (
        f"Expected 204 from DELETE /api/sessions/me, got {r.status_code}: {r.text}"
    )
    clear_cookie = _find_sid_set_cookie(r)
    assert clear_cookie is not None, (
        "DELETE /api/sessions/me did not include a Set-Cookie header to clear sid."
    )
    lower_cc = clear_cookie.lower()
    assert clear_cookie.startswith("sid="), (
        f"Clearing Set-Cookie should start with 'sid='; got {clear_cookie!r}"
    )
    assert "max-age=0" in lower_cc, (
        f"Clearing Set-Cookie must include Max-Age=0; got {clear_cookie!r}"
    )
    assert "httponly" in lower_cc, (
        f"Clearing Set-Cookie must include HttpOnly; got {clear_cookie!r}"
    )
    assert "path=/" in lower_cc, (
        f"Clearing Set-Cookie must include Path=/; got {clear_cookie!r}"
    )

    # ---- Step 10: old sid should no longer authenticate ----
    r = requests.get(
        f"{BASE_URL}/api/sessions/me",
        headers={"Cookie": f"sid={sid_alice}"},
        timeout=10,
    )
    assert r.status_code == 401, (
        f"Expected 401 with deleted sid, got {r.status_code}: {r.text}"
    )

    # ---- Step 11: count should reflect the deletion ----
    r = requests.get(f"{BASE_URL}/api/sessions/count", timeout=10)
    assert r.status_code == 200
    assert r.json() == {"count": 1}, (
        f"Expected count 1 after deleting alice, got {r.json()}"
    )
