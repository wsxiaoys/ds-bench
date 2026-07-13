import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
BASE = f"http://127.0.0.1:{PORT}"

# Seed users from /home/user/project/users.json
ALICE = {"username": "alice", "password": "correct-horse-battery-staple", "id": "usr_alice"}
BOB = {"username": "bob", "password": "hunter2-passphrase", "id": "usr_bob"}


def _port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex((host, port)) == 0


def _wait_for_http(timeout: int = 180) -> None:
    """Wait until the dev server answers an HTTP request (first hit may compile)."""
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            requests.get(BASE + "/profile", timeout=10)
            return
        except requests.RequestException as e:  # noqa: PERF203
            last_err = e
            time.sleep(2)
    raise RuntimeError(f"Server did not become ready in {timeout}s: {last_err}")


@pytest.fixture(scope="session")
def server(xprocess):
    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        # CRITICAL: set `env` as a class attribute, never inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            return _port_open("127.0.0.1", PORT)

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            return
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] rwsdk_dev log =====")
        print("".join(new))
        print(f"===== [{tag}] end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    _wait_for_http()

    yield BASE

    capture_logs("TEARDOWN")
    info.terminate()


def _login(session: requests.Session, username: str, password: str) -> requests.Response:
    return session.post(
        BASE + "/login",
        json={"username": username, "password": password},
        timeout=30,
    )


def _extract_set_cookie(resp: requests.Response) -> str:
    """Return the raw Set-Cookie header string for session_id, or '' if absent."""
    # requests joins multiple Set-Cookie headers with ", "; find the session_id one.
    raw = resp.headers.get("Set-Cookie", "")
    if "session_id=" not in raw:
        return ""
    return raw


def _cookie_value_from_jar(session: requests.Session) -> str:
    return session.cookies.get("session_id", "") or ""


def test_login_valid_sets_httponly_cookie(server):
    s = requests.Session()
    resp = _login(s, ALICE["username"], ALICE["password"])
    assert resp.status_code == 200, f"Valid login should return 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body.get("id") == ALICE["id"], f"Expected id {ALICE['id']}, got {body}"
    assert body.get("username") == ALICE["username"], f"Expected username alice, got {body}"
    assert "password" not in body, f"Login response must not include password: {body}"

    set_cookie = _extract_set_cookie(resp)
    assert set_cookie, f"Login must set a session_id cookie. Set-Cookie: {resp.headers.get('Set-Cookie')!r}"
    assert re.search(r"httponly", set_cookie, re.IGNORECASE), \
        f"session_id cookie must be HttpOnly. Set-Cookie: {set_cookie!r}"
    assert re.search(r"path=/", set_cookie, re.IGNORECASE), \
        f"session_id cookie must set Path=/. Set-Cookie: {set_cookie!r}"

    value = _cookie_value_from_jar(s)
    assert value, "session_id cookie value should be a non-empty opaque id."
    assert value not in (ALICE["username"], ALICE["id"]), \
        f"session_id must be opaque, not the username/user id (got {value!r})."


def test_profile_authenticated(server):
    s = requests.Session()
    assert _login(s, ALICE["username"], ALICE["password"]).status_code == 200
    resp = s.get(BASE + "/profile", timeout=30)
    assert resp.status_code == 200, f"Authenticated profile should be 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body.get("id") == ALICE["id"], f"Expected id {ALICE['id']}, got {body}"
    assert body.get("username") == ALICE["username"], f"Expected username alice, got {body}"
    assert ALICE["password"] not in resp.text, "Profile response must not leak the password."


def test_profile_without_cookie(server):
    resp = requests.get(BASE + "/profile", timeout=30)
    assert resp.status_code == 401, f"Profile without cookie should be 401, got {resp.status_code}"


def test_profile_with_forged_cookie(server):
    resp = requests.get(
        BASE + "/profile",
        cookies={"session_id": "zznonexistent-session-9999"},
        timeout=30,
    )
    assert resp.status_code == 401, \
        f"Profile with unknown session id should be 401, got {resp.status_code}"


def test_login_wrong_password(server):
    s = requests.Session()
    resp = _login(s, ALICE["username"], "wrong-password")
    assert resp.status_code == 401, f"Wrong password should return 401, got {resp.status_code}"
    # Any cookie returned (if present) must not grant access.
    profile = s.get(BASE + "/profile", timeout=30)
    assert profile.status_code == 401, \
        "A failed login must not produce a session that can access /profile."


def test_login_unknown_username(server):
    s = requests.Session()
    resp = _login(s, "charlie", "whatever")
    assert resp.status_code == 401, f"Unknown username should return 401, got {resp.status_code}"


def test_login_malformed_body(server):
    resp = requests.post(BASE + "/login", json={"username": "alice"}, timeout=30)
    assert resp.status_code == 400, f"Missing password should return 400, got {resp.status_code}"


def test_second_user_isolation(server):
    s = requests.Session()
    resp = _login(s, BOB["username"], BOB["password"])
    assert resp.status_code == 200, f"Bob login should return 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body.get("id") == BOB["id"] and body.get("username") == BOB["username"], \
        f"Expected bob profile, got {body}"
    profile = s.get(BASE + "/profile", timeout=30)
    assert profile.status_code == 200, f"Bob profile should be 200, got {profile.status_code}"
    pbody = profile.json()
    assert pbody.get("id") == BOB["id"] and pbody.get("username") == BOB["username"], \
        f"Expected bob profile from /profile, got {pbody}"


def test_logout_invalidates_session(server):
    s = requests.Session()
    assert _login(s, ALICE["username"], ALICE["password"]).status_code == 200
    original_cookie = _cookie_value_from_jar(s)
    assert original_cookie, "Expected a session_id cookie after login."

    # Confirm it works before logout.
    assert s.get(BASE + "/profile", timeout=30).status_code == 200

    logout = s.post(BASE + "/logout", timeout=30)
    assert logout.status_code == 200, f"Logout should return 200, got {logout.status_code}"
    set_cookie = logout.headers.get("Set-Cookie", "")
    assert "session_id=" in set_cookie, \
        f"Logout should send a Set-Cookie clearing session_id. Got: {set_cookie!r}"
    cleared = (
        re.search(r"session_id=;", set_cookie)
        or re.search(r"max-age=0", set_cookie, re.IGNORECASE)
        or re.search(r"expires=", set_cookie, re.IGNORECASE)
    )
    assert cleared, f"Logout cookie should be emptied/expired. Set-Cookie: {set_cookie!r}"

    # The ORIGINAL session id must no longer be valid server-side (KV record deleted).
    resp = requests.get(
        BASE + "/profile",
        cookies={"session_id": original_cookie},
        timeout=30,
    )
    assert resp.status_code == 401, \
        "After logout, the original session id must be rejected (KV session deleted)."
