import os
import socket
import uuid

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/rbac-dashboard"
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

# Seeded accounts (must match the task's required seed data).
ADMIN = {"username": "admin", "password": "Admin#123", "role": "admin"}
EDITOR = {"username": "editor", "password": "Editor#123", "role": "editor"}
VIEWER = {"username": "viewer", "password": "Viewer#123", "role": "viewer"}

SEED_CONTENT = [
    {"id": 1, "title": "Getting Started", "body": "Welcome to the dashboard"},
    {"id": 2, "title": "Company Roadmap", "body": "Plans for the next quarter"},
]


def _unique_suffix():
    """Derive a unique suffix so repeated eval runs never collide on unique
    username constraints a correct implementation might enforce."""
    try:
        with open("/logs/artifacts/run-id") as f:
            rid = f.read().strip()
            if rid:
                return rid
    except OSError:
        pass
    return "zr" + uuid.uuid4().hex[:10]


UNIQUE = _unique_suffix()


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "rbac_dashboard"
        args = ["npm", "run", "dev", "--", "--port", str(PORT), "--host", HOST]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{BASE_URL}/login", timeout=30)
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
        print(f"===== [{tag}: Begin] {Starter.name} log (skipped {skipped}) =====")
        print("".join(new_lines))
        print(f"===== [{tag}: End] {Starter.name} log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _login(creds):
    """Log in and return the authenticated requests.Session (cookie jar)."""
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/api/login", json=creds, timeout=30)
    return s, resp


# 1
def test_login_rejects_bad_credentials(start_app):
    s = requests.Session()
    resp = s.post(
        f"{BASE_URL}/api/login",
        json={"username": "admin", "password": "wrong"},
        timeout=30,
    )
    assert resp.status_code == 401, (
        f"Expected 401 for bad credentials, got {resp.status_code}: {resp.text}"
    )
    assert "error" in resp.json(), f"Expected an 'error' field, got: {resp.text}"
    assert "session" not in s.cookies, "A session cookie must NOT be issued on failed login."


# 2
def test_viewer_login(start_app):
    s, resp = _login(VIEWER)
    assert resp.status_code == 200, (
        f"Expected 200 for viewer login, got {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert data.get("username") == "viewer", f"Unexpected username in response: {data}"
    assert data.get("role") == "viewer", f"Unexpected role in response: {data}"
    assert "session" in s.cookies, "A 'session' cookie must be set on successful login."


# 3
def test_viewer_can_read_content(start_app):
    s, _ = _login(VIEWER)
    resp = s.get(f"{BASE_URL}/api/content", timeout=30)
    assert resp.status_code == 200, (
        f"Expected 200 reading content as viewer, got {resp.status_code}: {resp.text}"
    )
    items = resp.json()
    assert isinstance(items, list), f"Expected a JSON array, got: {items}"
    by_id = {i["id"]: i for i in items if "id" in i}
    for seed in SEED_CONTENT:
        assert seed["id"] in by_id, f"Seeded content id {seed['id']} missing: {items}"
        got = by_id[seed["id"]]
        assert got.get("title") == seed["title"], f"Wrong title for id {seed['id']}: {got}"
        assert got.get("body") == seed["body"], f"Wrong body for id {seed['id']}: {got}"


# 4
def test_viewer_cannot_create_content(start_app):
    s, _ = _login(VIEWER)
    resp = s.post(
        f"{BASE_URL}/api/content",
        json={"title": "Hack", "body": "nope"},
        timeout=30,
    )
    assert resp.status_code == 403, (
        f"Viewer creating content must be 403, got {resp.status_code}: {resp.text}"
    )
    # Confirm no side effect: the item was not persisted.
    listing = s.get(f"{BASE_URL}/api/content", timeout=30).json()
    titles = [i.get("title") for i in listing]
    assert "Hack" not in titles, "Viewer POST must not persist content."


# 5
def test_viewer_cannot_access_admin_users(start_app):
    s, _ = _login(VIEWER)
    resp = s.get(f"{BASE_URL}/api/admin/users", timeout=30)
    assert resp.status_code == 403, (
        f"Viewer accessing admin users must be 403, got {resp.status_code}: {resp.text}"
    )


# 6
def test_unauthenticated_blocked(start_app):
    r1 = requests.get(f"{BASE_URL}/api/content", timeout=30)
    assert r1.status_code == 401, f"Unauthenticated GET /api/content must be 401, got {r1.status_code}"

    r2 = requests.post(
        f"{BASE_URL}/api/content", json={"title": "x", "body": "y"}, timeout=30
    )
    assert r2.status_code == 401, f"Unauthenticated POST /api/content must be 401, got {r2.status_code}"

    r3 = requests.get(f"{BASE_URL}/api/admin/users", timeout=30)
    assert r3.status_code == 401, f"Unauthenticated GET /api/admin/users must be 401, got {r3.status_code}"


# 7
def test_unauthenticated_admin_page_redirects(start_app):
    resp = requests.get(f"{BASE_URL}/admin", timeout=30, allow_redirects=False)
    assert 300 <= resp.status_code < 400, (
        f"Unauthenticated GET /admin must redirect (3xx), got {resp.status_code}"
    )
    location = resp.headers.get("Location", "")
    assert "/login" in location, f"Redirect Location must point to /login, got: {location!r}"


# 8
def test_editor_login_and_create_content(start_app):
    s, resp = _login(EDITOR)
    assert resp.status_code == 200 and resp.json().get("role") == "editor", (
        f"Editor login failed: {resp.status_code} {resp.text}"
    )
    create = s.post(
        f"{BASE_URL}/api/content",
        json={"title": "Editor Post", "body": "created by editor"},
        timeout=30,
    )
    assert create.status_code == 201, (
        f"Editor creating content must be 201, got {create.status_code}: {create.text}"
    )
    created = create.json()
    assert isinstance(created.get("id"), int), f"Created content must have numeric id: {created}"
    assert created.get("title") == "Editor Post", f"Echoed title wrong: {created}"
    assert created.get("body") == "created by editor", f"Echoed body wrong: {created}"

    listing = s.get(f"{BASE_URL}/api/content", timeout=30).json()
    match = [i for i in listing if i.get("id") == created["id"]]
    assert match and match[0].get("title") == "Editor Post", (
        f"Created content id {created['id']} not found in listing: {listing}"
    )


# 9
def test_editor_create_ignores_client_id(start_app):
    s, _ = _login(EDITOR)
    resp = s.post(
        f"{BASE_URL}/api/content",
        json={"id": 9999, "title": "Ignore Id", "body": "b"},
        timeout=30,
    )
    assert resp.status_code == 201, (
        f"Editor create must be 201, got {resp.status_code}: {resp.text}"
    )
    assert resp.json().get("id") != 9999, (
        "Server must assign the id and ignore the client-supplied id."
    )


# 10
def test_editor_cannot_manage_users(start_app):
    s, _ = _login(EDITOR)
    g = s.get(f"{BASE_URL}/api/admin/users", timeout=30)
    assert g.status_code == 403, f"Editor GET /api/admin/users must be 403, got {g.status_code}"

    p = s.post(
        f"{BASE_URL}/api/admin/users",
        json={"username": "x", "password": "y", "role": "viewer"},
        timeout=30,
    )
    assert p.status_code == 403, f"Editor POST /api/admin/users must be 403, got {p.status_code}"


# 11
def test_editor_delete_content(start_app):
    s, _ = _login(EDITOR)
    created = s.post(
        f"{BASE_URL}/api/content",
        json={"title": "To Delete", "body": "temp"},
        timeout=30,
    )
    assert created.status_code == 201, f"Setup create failed: {created.text}"
    content_id = created.json()["id"]

    d1 = s.delete(f"{BASE_URL}/api/content/{content_id}", timeout=30)
    assert d1.status_code == 200, f"First delete must be 200, got {d1.status_code}: {d1.text}"

    d2 = s.delete(f"{BASE_URL}/api/content/{content_id}", timeout=30)
    assert d2.status_code == 404, f"Deleting already-deleted id must be 404, got {d2.status_code}"

    d3 = s.delete(f"{BASE_URL}/api/content/999999", timeout=30)
    assert d3.status_code == 404, f"Deleting non-existent id must be 404, got {d3.status_code}"


# 12
def test_admin_login(start_app):
    _, resp = _login(ADMIN)
    assert resp.status_code == 200, f"Admin login must be 200, got {resp.status_code}: {resp.text}"
    assert resp.json().get("role") == "admin", f"Admin role expected, got: {resp.text}"


# 13
def test_admin_lists_users_without_passwords(start_app):
    s, _ = _login(ADMIN)
    resp = s.get(f"{BASE_URL}/api/admin/users", timeout=30)
    assert resp.status_code == 200, (
        f"Admin GET /api/admin/users must be 200, got {resp.status_code}: {resp.text}"
    )
    users = resp.json()
    assert isinstance(users, list), f"Expected a JSON array of users, got: {users}"
    usernames = {u.get("username") for u in users}
    for expected in ("admin", "editor", "viewer"):
        assert expected in usernames, f"Expected user '{expected}' in listing: {usernames}"
    for u in users:
        assert "password" not in u, f"User objects must NOT include a password field: {u}"
        assert "id" in u and "username" in u and "role" in u, (
            f"Each user must have id, username, role: {u}"
        )


# 14
def test_admin_creates_user_and_invalid_role(start_app):
    s, _ = _login(ADMIN)
    new_username = f"newbie_{UNIQUE}"
    new_password = "Newbie#123"
    create = s.post(
        f"{BASE_URL}/api/admin/users",
        json={"username": new_username, "password": new_password, "role": "editor"},
        timeout=30,
    )
    assert create.status_code == 201, (
        f"Admin creating a user must be 201, got {create.status_code}: {create.text}"
    )
    body = create.json()
    assert body.get("username") == new_username, f"Created username wrong: {body}"
    assert body.get("role") == "editor", f"Created role wrong: {body}"

    bad = s.post(
        f"{BASE_URL}/api/admin/users",
        json={"username": f"bad_{UNIQUE}", "password": "p", "role": "superuser"},
        timeout=30,
    )
    assert bad.status_code == 400, (
        f"Invalid role must be rejected with 400, got {bad.status_code}: {bad.text}"
    )

    # The newly created user must actually be able to log in (persisted correctly).
    ns, login_resp = _login({"username": new_username, "password": new_password})
    assert login_resp.status_code == 200, (
        f"Newly created user must be able to log in, got {login_resp.status_code}: {login_resp.text}"
    )
    assert login_resp.json().get("role") == "editor", (
        f"Newly created user role must be editor: {login_resp.text}"
    )


# 15
def test_admin_page_access_control(start_app):
    viewer_s, _ = _login(VIEWER)
    rv = viewer_s.get(f"{BASE_URL}/admin", timeout=30, allow_redirects=False)
    assert rv.status_code == 403, f"Viewer GET /admin must be 403, got {rv.status_code}"

    editor_s, _ = _login(EDITOR)
    re_ = editor_s.get(f"{BASE_URL}/admin", timeout=30, allow_redirects=False)
    assert re_.status_code == 403, f"Editor GET /admin must be 403, got {re_.status_code}"

    admin_s, _ = _login(ADMIN)
    ra = admin_s.get(f"{BASE_URL}/admin", timeout=30)
    assert ra.status_code == 200, f"Admin GET /admin must be 200, got {ra.status_code}"
    assert "User Management" in ra.text, (
        "Admin dashboard HTML must contain the text 'User Management'."
    )


# 16
def test_login_page_browser(start_app):
    verifier = PochiVerifier()
    reason = (
        "The application must serve a login page at /login that renders a login form "
        "for username and password."
    )
    truth = (
        f"Navigate to {BASE_URL}/login. Verify that the page loads successfully and "
        "displays a login form with fields for a username and a password."
    )
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_login_page_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
