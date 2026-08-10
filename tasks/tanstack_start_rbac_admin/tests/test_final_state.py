import os
import re
import socket
import sqlite3

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/project"
PORT = 34517

# Connect over IPv4 explicitly first. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); we keep `localhost` as a fallback in case the app bound
# only the IPv6 loopback.
CANDIDATE_HOSTS = ["127.0.0.1", "localhost"]
BROWSER_BASE_URL = f"http://localhost:{PORT}"

DB_FILES = [
    os.path.join(PROJECT_DIR, "data", "app.sqlite"),
    os.path.join(PROJECT_DIR, "data", "app.sqlite-wal"),
    os.path.join(PROJECT_DIR, "data", "app.sqlite-shm"),
]
DB_MAIN = DB_FILES[0]

MARKER = "ADMIN CONSOLE 8842"
COOKIE_NAME = "rbac_session"

ADMIN_EMAIL = "root@example.com"
ADMIN_PASSWORD = "Adm1n!pass9"

MEMBER_EMAIL = "member@example.com"
PAT_EMAIL = "pat@example.com"
SAM_EMAIL = "sam@example.com"
JORDAN_EMAIL = "jordan@example.com"
USER_PASSWORD = "Us3r!pass42"

SEEDED_USER_EMAILS = [MEMBER_EMAIL, PAT_EMAIL, SAM_EMAIL, JORDAN_EMAIL]
ALL_SEEDED_EMAILS = [ADMIN_EMAIL] + SEEDED_USER_EMAILS

# Holds the base URL that actually responds, resolved once the app is up.
_BASE = {"url": None}


def base_url():
    assert _BASE["url"] is not None, "Base URL has not been resolved yet."
    return _BASE["url"]


def _try_hosts_get(path):
    """GET a path trying each candidate host; return (base_url, response) or (None, error)."""
    last = None
    for host in CANDIDATE_HOSTS:
        url = f"http://{host}:{PORT}"
        try:
            resp = requests.get(url + path, timeout=30)
            return url, resp
        except requests.RequestException as e:  # noqa: PERF203
            last = e
            continue
    return None, last


def set_cookie_lines(resp):
    """Return the list of raw Set-Cookie header lines from a response."""
    try:
        lines = resp.raw.headers.getlist("Set-Cookie")
        if lines:
            return lines
    except Exception:  # noqa: BLE001
        pass
    combined = resp.headers.get("Set-Cookie")
    return [combined] if combined else []


def session_set_cookie_line(resp):
    for line in set_cookie_lines(resp):
        if line and line.strip().lower().startswith(COOKIE_NAME.lower() + "="):
            return line
    return None


def read_users():
    """Open the SQLite DB read-only and return {email: row_dict} for the users table."""
    assert os.path.isfile(DB_MAIN), f"SQLite database must exist at {DB_MAIN}"
    conn = sqlite3.connect(DB_MAIN, timeout=20)
    try:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM users").fetchall()
    finally:
        conn.close()
    result = {}
    for row in rows:
        keys = row.keys()
        assert "email" in keys, "The 'users' table must have an 'email' column"
        assert "password_hash" in keys, "The 'users' table must have a 'password_hash' column"
        assert "role" in keys, "The 'users' table must have a 'role' column"
        result[row["email"]] = row
    return result


def role_in_db(email):
    users = read_users()
    assert email in users, f"The 'users' table must contain a row for {email}"
    return users[email]["role"]


def login(email, password):
    """Return a requests.Session logged in as the given account, plus the raw response."""
    client = requests.Session()
    resp = client.post(base_url() + "/api/login", json={"email": email, "password": password}, timeout=30)
    return client, resp


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    # Reset persisted state so seeding is deterministic for this run.
    for path in DB_FILES:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except OSError as e:
            print(f"Warning: could not remove {path}: {e}")

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            # Port must be open on at least one candidate host.
            port_open = False
            for host in CANDIDATE_HOSTS:
                connect_host = "127.0.0.1" if host == "127.0.0.1" else "localhost"
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    if s.connect_ex((connect_host, PORT)) == 0:
                        port_open = True
                        break
            if not port_open:
                return False
            # Confirm the API actually responds (first request may build).
            # /api/me returns 401 when unauthenticated, which is a healthy signal.
            url, resp = _try_hosts_get("/api/me")
            if url is None:
                return False
            if resp.status_code < 500:
                _BASE["url"] = url
                return True
            return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            all_lines = []
        new_lines = all_lines[printed_log_lines:]
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] {Starter.name} log =====================")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} log =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    # Ensure the base URL is resolved even if xprocess cached a previous run.
    if _BASE["url"] is None:
        url, resp = _try_hosts_get("/api/me")
        if url is not None:
            _BASE["url"] = url

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def test_unauthenticated_access_rejected_server_side(start_app):
    """No session -> /api/me, /api/admin/users and the privileged action must be rejected server-side."""
    base = base_url()

    me = requests.get(base + "/api/me", timeout=30)
    assert me.status_code == 401, f"GET /api/me without a session must return 401, got {me.status_code}"
    try:
        assert me.json() == {"user": None}, f"Unauthenticated /api/me body must be {{'user': null}}, got {me.text!r}"
    except ValueError:
        pytest.fail(f"GET /api/me must return JSON, got {me.text!r}")

    users = requests.get(base + "/api/admin/users", timeout=30)
    assert users.status_code == 401, (
        f"GET /api/admin/users without a session must return 401, got {users.status_code}"
    )
    assert ADMIN_EMAIL not in users.text, "Unauthenticated /api/admin/users must NOT leak account emails"
    assert MARKER not in users.text, "Unauthenticated /api/admin/users must NOT leak the admin marker"

    # Privileged action without a session must be rejected and must not mutate.
    set_role = requests.post(
        base + "/api/admin/set-role",
        json={"email": PAT_EMAIL, "role": "admin"},
        timeout=30,
    )
    assert set_role.status_code == 401, (
        f"POST /api/admin/set-role without a session must return 401, got {set_role.status_code}"
    )
    assert role_in_db(PAT_EMAIL) == "user", (
        "An unauthenticated set-role call must not change any role in the database"
    )

    # Admin page must not be reachable without a session.
    admin_page = requests.get(base + "/admin", timeout=30, allow_redirects=False)
    if admin_page.status_code in (301, 302, 303, 307, 308):
        location = admin_page.headers.get("Location", "")
        assert "login" in location.lower(), (
            f"Unauthenticated /admin must redirect to the login page, got Location={location!r}"
        )
    else:
        assert MARKER not in admin_page.text, (
            f"Unauthenticated /admin must not render the admin console (status {admin_page.status_code})"
        )


def test_login_returns_role(start_app):
    """Login returns the account's role; the session cookie is HttpOnly + SameSite=Lax and not Secure."""
    base = base_url()

    admin_client, admin_resp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_resp.status_code == 200, (
        f"Admin login must return 200, got {admin_resp.status_code}: {admin_resp.text!r}"
    )
    assert admin_resp.json() == {"user": {"email": ADMIN_EMAIL, "role": "admin"}}, (
        f"Admin login body wrong, got {admin_resp.text!r}"
    )

    cookie_line = session_set_cookie_line(admin_resp)
    assert cookie_line is not None, (
        f"Login must set a cookie named '{COOKIE_NAME}'. Set-Cookie lines: {set_cookie_lines(admin_resp)!r}"
    )
    low = cookie_line.lower()
    assert "httponly" in low, f"The '{COOKIE_NAME}' cookie must be HttpOnly. Got: {cookie_line!r}"
    assert "samesite=lax" in low, f"The '{COOKIE_NAME}' cookie must use SameSite=Lax. Got: {cookie_line!r}"
    assert not re.search(r"(?i)(?:^|;\s*)secure(?:\s*;|\s*$)", cookie_line), (
        f"The '{COOKIE_NAME}' cookie must NOT set Secure over plain HTTP. Got: {cookie_line!r}"
    )

    member_client, member_resp = login(MEMBER_EMAIL, USER_PASSWORD)
    assert member_resp.status_code == 200, (
        f"Member login must return 200, got {member_resp.status_code}: {member_resp.text!r}"
    )
    assert member_resp.json() == {"user": {"email": MEMBER_EMAIL, "role": "user"}}, (
        f"Member login body wrong, got {member_resp.text!r}"
    )

    # Invalid credentials establish no session.
    bad_client = requests.Session()
    bad = bad_client.post(
        base + "/api/login",
        json={"email": ADMIN_EMAIL, "password": "wrong-password"},
        timeout=30,
    )
    assert bad.status_code == 401, f"Login with a wrong password must return 401, got {bad.status_code}"
    me_bad = bad_client.get(base + "/api/me", timeout=30)
    assert me_bad.status_code == 401, "A failed login must not establish a session"


def test_non_admin_forbidden_server_side(start_app):
    """A logged-in non-admin is denied the admin listing and the privileged action (403), with no mutation."""
    base = base_url()

    member_client, member_resp = login(MEMBER_EMAIL, USER_PASSWORD)
    assert member_resp.status_code == 200, f"Member login must return 200, got {member_resp.status_code}"

    # Sanity: the member session is valid but its role is 'user'.
    me = member_client.get(base + "/api/me", timeout=30)
    assert me.status_code == 200, f"Authenticated /api/me must return 200, got {me.status_code}"
    assert me.json() == {"user": {"email": MEMBER_EMAIL, "role": "user"}}, f"/api/me body wrong, got {me.text!r}"

    listing = member_client.get(base + "/api/admin/users", timeout=30)
    assert listing.status_code == 403, (
        f"A non-admin calling GET /api/admin/users must be forbidden (403), got {listing.status_code}"
    )

    set_role = member_client.post(
        base + "/api/admin/set-role",
        json={"email": PAT_EMAIL, "role": "admin"},
        timeout=30,
    )
    assert set_role.status_code == 403, (
        f"A non-admin calling POST /api/admin/set-role must be forbidden (403), got {set_role.status_code}"
    )
    assert role_in_db(PAT_EMAIL) == "user", (
        "A forbidden set-role call must not change any role in the database (no bypass)"
    )


def test_admin_can_list_users(start_app):
    """An admin can list every account with its current role."""
    base = base_url()

    admin_client, admin_resp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_resp.status_code == 200, f"Admin login must return 200, got {admin_resp.status_code}"

    listing = admin_client.get(base + "/api/admin/users", timeout=30)
    assert listing.status_code == 200, f"Admin GET /api/admin/users must return 200, got {listing.status_code}"
    body = listing.json()
    assert isinstance(body, dict) and isinstance(body.get("users"), list), (
        f"/api/admin/users body must be {{'users': [...]}}, got {listing.text!r}"
    )
    by_email = {u["email"]: u["role"] for u in body["users"]}
    for email in ALL_SEEDED_EMAILS:
        assert email in by_email, f"/api/admin/users must include {email}, got {sorted(by_email)}"
    assert by_email[ADMIN_EMAIL] == "admin", f"{ADMIN_EMAIL} must have role admin, got {by_email[ADMIN_EMAIL]!r}"
    assert by_email[MEMBER_EMAIL] == "user", f"{MEMBER_EMAIL} must have role user, got {by_email[MEMBER_EMAIL]!r}"


def test_admin_privileged_action_persists(start_app):
    """The admin privileged action mutates the role and persists it to SQLite; demotion works too."""
    base = base_url()

    admin_client, admin_resp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_resp.status_code == 200, f"Admin login must return 200, got {admin_resp.status_code}"

    # Promote pat -> admin.
    promote = admin_client.post(
        base + "/api/admin/set-role",
        json={"email": PAT_EMAIL, "role": "admin"},
        timeout=30,
    )
    assert promote.status_code == 200, f"Admin set-role must return 200, got {promote.status_code}: {promote.text!r}"
    assert promote.json() == {"user": {"email": PAT_EMAIL, "role": "admin"}}, (
        f"set-role response body wrong, got {promote.text!r}"
    )

    listing = admin_client.get(base + "/api/admin/users", timeout=30)
    by_email = {u["email"]: u["role"] for u in listing.json()["users"]}
    assert by_email[PAT_EMAIL] == "admin", f"After promotion {PAT_EMAIL} must be admin in the listing, got {by_email[PAT_EMAIL]!r}"
    assert role_in_db(PAT_EMAIL) == "admin", f"After promotion {PAT_EMAIL} must be admin in the database"

    # Promote then demote sam -> admin -> user; final state must be 'user' and persisted.
    up = admin_client.post(
        base + "/api/admin/set-role",
        json={"email": SAM_EMAIL, "role": "admin"},
        timeout=30,
    )
    assert up.status_code == 200, f"Promoting {SAM_EMAIL} must return 200, got {up.status_code}"
    assert role_in_db(SAM_EMAIL) == "admin", f"{SAM_EMAIL} must be admin after promotion"

    down = admin_client.post(
        base + "/api/admin/set-role",
        json={"email": SAM_EMAIL, "role": "user"},
        timeout=30,
    )
    assert down.status_code == 200, f"Demoting {SAM_EMAIL} must return 200, got {down.status_code}"
    assert down.json() == {"user": {"email": SAM_EMAIL, "role": "user"}}, (
        f"Demotion response body wrong, got {down.text!r}"
    )
    assert role_in_db(SAM_EMAIL) == "user", f"{SAM_EMAIL} must be back to user after demotion (persisted)"


def test_set_role_validation(start_app):
    """Invalid role -> 400; unknown target email -> 404."""
    base = base_url()

    admin_client, admin_resp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_resp.status_code == 200, f"Admin login must return 200, got {admin_resp.status_code}"

    bad_role = admin_client.post(
        base + "/api/admin/set-role",
        json={"email": PAT_EMAIL, "role": "superuser"},
        timeout=30,
    )
    assert bad_role.status_code == 400, (
        f"set-role with an invalid role value must return 400, got {bad_role.status_code}"
    )

    unknown = admin_client.post(
        base + "/api/admin/set-role",
        json={"email": "ghost@example.com", "role": "admin"},
        timeout=30,
    )
    assert unknown.status_code == 404, (
        f"set-role for an unknown target email must return 404, got {unknown.status_code}"
    )


def test_logout_invalidates_session(start_app):
    """Logout invalidates the session so protected access is denied afterward."""
    base = base_url()

    admin_client, admin_resp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert admin_resp.status_code == 200, f"Admin login must return 200, got {admin_resp.status_code}"

    logout = admin_client.post(base + "/api/logout", timeout=30)
    assert logout.status_code == 200, f"Logout must return 200, got {logout.status_code}"
    assert logout.json() == {"ok": True}, f"Logout body must be {{'ok': true}}, got {logout.text!r}"

    me = admin_client.get(base + "/api/me", timeout=30)
    assert me.status_code == 401, f"After logout, /api/me must return 401, got {me.status_code}"
    listing = admin_client.get(base + "/api/admin/users", timeout=30)
    assert listing.status_code == 401, f"After logout, /api/admin/users must return 401, got {listing.status_code}"


def test_passwords_stored_salted_and_never_plaintext(start_app):
    """Accounts sharing a password have distinct hashes; plaintext passwords are never stored."""
    users = read_users()

    for email in ALL_SEEDED_EMAILS:
        assert email in users, f"The 'users' table must contain a row for {email}"

    # No stored value may equal or contain any plaintext password.
    for email, row in users.items():
        for key in row.keys():
            value = row[key]
            if isinstance(value, (bytes, bytearray)):
                try:
                    value = value.decode("utf-8", "ignore")
                except Exception:  # noqa: BLE001
                    value = ""
            if isinstance(value, str):
                assert USER_PASSWORD not in value, (
                    f"Plaintext user password found in users.{key} for {email} -- passwords must be hashed"
                )
                assert ADMIN_PASSWORD not in value, (
                    f"Plaintext admin password found in users.{key} for {email} -- passwords must be hashed"
                )

    # The four users that share USER_PASSWORD must have pairwise-distinct hashes (per-user salt).
    shared_hashes = [users[email]["password_hash"] for email in SEEDED_USER_EMAILS]
    assert len(set(shared_hashes)) == len(shared_hashes), (
        "Accounts that share the same password must have distinct password_hash values (per-user salt required)"
    )


def test_browser_end_to_end(start_app, browser_verifier):
    reason = (
        "The app must implement role-based access control in TanStack Start: an admin-only route shows an admin "
        "console and lets an admin change another account's role via a server-enforced privileged action, while a "
        "non-admin is denied the admin route, and role changes persist across reloads."
    )
    truth = (
        f"First, navigate to {BROWSER_BASE_URL}/login and log in with email '{MEMBER_EMAIL}' and password "
        f"'{USER_PASSWORD}'. Then navigate directly to {BROWSER_BASE_URL}/admin and verify this normal user is "
        f"denied: the text 'ADMIN CONSOLE 8842' is NOT shown (the user is redirected to the login page or otherwise "
        "blocked from the admin content). Then log out. "
        f"Next, navigate to {BROWSER_BASE_URL}/login and log in with email '{ADMIN_EMAIL}' and password "
        f"'{ADMIN_PASSWORD}'. Navigate to {BROWSER_BASE_URL}/admin and verify the page shows the text "
        f"'ADMIN CONSOLE 8842' and lists the account '{JORDAN_EMAIL}' with the role 'user'. Use the on-page control "
        f"to change the role of '{JORDAN_EMAIL}' to 'admin', and verify the page then shows '{JORDAN_EMAIL}' with the "
        f"role 'admin'. Finally, reload {BROWSER_BASE_URL}/admin and verify that '{JORDAN_EMAIL}' is still shown with "
        "the role 'admin' (the change persisted without needing to log in again)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_end_to_end",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
