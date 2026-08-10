import os
import socket
import sqlite3
import subprocess
import uuid
from urllib.parse import urlparse, parse_qs, unquote

import pytest
import requests
from xprocess import ProcessStarter
from playwright.sync_api import sync_playwright

PROJECT_DIR = "/home/user/tanstack-auth"
DB_PATH = "/home/user/tanstack-auth/data/app.db"
PORT = 8791
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1); forcing 127.0.0.1 keeps the readiness probe and the tests
# talking to the same address the server listens on.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

PASSWORD = "Sup3rSecret!pw"
WRONG_PASSWORD = "totally-wrong-pw"


def _unique_username(prefix="alice"):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# --------------------------------------------------------------------------- #
# Server lifecycle
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def app_server(xprocess):
    # Start from a clean database so re-runs are deterministic.
    for suffix in ("", "-wal", "-shm"):
        p = DB_PATH + suffix
        if os.path.isfile(p):
            os.remove(p)

    # Build the production app before serving it.
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
    )
    print("===== npm run build stdout =====")
    print(build.stdout[-8000:])
    print("===== npm run build stderr =====")
    print(build.stderr[-8000:])
    assert build.returncode == 0, f"`npm run build` failed with code {build.returncode}."

    server_env = os.environ.copy()
    server_env["PORT"] = str(PORT)
    server_env["HOST"] = HOST

    class Starter(ProcessStarter):
        name = "tanstack_auth_app"
        args = ["npm", "run", "start"]
        env = server_env
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL + "/", timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

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
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new))
        print(f"===== [{tag}] end log =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser(app_server):
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()


# --------------------------------------------------------------------------- #
# Browser helpers
# --------------------------------------------------------------------------- #
def _submit(page):
    for sel in ('button[type="submit"]', 'input[type="submit"]'):
        el = page.query_selector(sel)
        if el is not None:
            el.click()
            return
    btn = page.query_selector("form button") or page.query_selector("button")
    if btn is not None:
        btn.click()
        return
    page.locator('input[name="password"]').press("Enter")


def _fill_credentials(page, username, password):
    page.wait_for_selector('input[name="username"]', timeout=30000)
    page.fill('input[name="username"]', username)
    page.fill('input[name="password"]', password)


def _wait_for_text(page, text, timeout=20000):
    page.wait_for_function(
        "t => !!document.body && document.body.innerText.includes(t)",
        arg=text,
        timeout=timeout,
    )


def _path(url):
    return urlparse(url).path.rstrip("/") or "/"


def _register(browser, username, password):
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE_URL + "/register", wait_until="domcontentloaded")
    _fill_credentials(page, username, password)
    _submit(page)
    page.wait_for_url("**/dashboard", timeout=30000)
    return context, page


# --------------------------------------------------------------------------- #
# Tests (each corresponds to a step in the truth verification plan)
# --------------------------------------------------------------------------- #
def test_registration_authenticates_user(browser):
    username = _unique_username()
    context, page = _register(browser, username, PASSWORD)
    try:
        assert _path(page.url) == "/dashboard", (
            f"After registration the browser should be on /dashboard, got {page.url}"
        )
        _wait_for_text(page, username)
    finally:
        context.close()


def test_session_cookie_is_http_only(browser):
    username = _unique_username()
    context, page = _register(browser, username, PASSWORD)
    try:
        cookies = context.cookies()
        http_only = [c for c in cookies if c.get("httpOnly")]
        assert len(http_only) >= 1, (
            "Expected at least one HTTP-only cookie after authentication; "
            f"got cookies: {[(c.get('name'), c.get('httpOnly')) for c in cookies]}"
        )
        js_cookie = page.evaluate("() => document.cookie") or ""
        for c in http_only:
            assert c.get("name") not in js_cookie, (
                f"HTTP-only cookie '{c.get('name')}' must not be readable via "
                f"document.cookie, but it was exposed: {js_cookie!r}"
            )
    finally:
        context.close()


def test_logout_invalidates_session_server_side(browser):
    username = _unique_username()
    context, page = _register(browser, username, PASSWORD)
    try:
        cookies_before_logout = context.cookies()
        assert any(c.get("httpOnly") for c in cookies_before_logout), (
            "Expected an HTTP-only session cookie to exist before logout."
        )

        page.get_by_text("Logout", exact=True).click()
        # After logout, the protected page must no longer be reachable.
        page.goto(BASE_URL + "/dashboard", wait_until="domcontentloaded")
        page.wait_for_url("**/login**", timeout=30000)
        assert _path(page.url) == "/login", (
            f"After logout, visiting /dashboard should redirect to /login, got {page.url}"
        )

        # Replay the pre-logout cookie in a brand-new context: it must be rejected,
        # proving the session was revoked server-side (not just cleared in the client).
        replay = browser.new_context()
        try:
            replay.add_cookies(cookies_before_logout)
            rpage = replay.new_page()
            rpage.goto(BASE_URL + "/dashboard", wait_until="domcontentloaded")
            rpage.wait_for_url("**/login**", timeout=30000)
            assert _path(rpage.url) == "/login", (
                "A session cookie captured before logout must NOT grant access after "
                f"logout (server-side revocation), but /dashboard was reachable: {rpage.url}"
            )
        finally:
            replay.close()
    finally:
        context.close()


def test_login_with_correct_credentials(browser):
    username = _unique_username()
    reg_context, _ = _register(browser, username, PASSWORD)
    reg_context.close()  # discard the auto-login session; log in fresh below.

    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto(BASE_URL + "/login", wait_until="domcontentloaded")
        _fill_credentials(page, username, PASSWORD)
        _submit(page)
        page.wait_for_url("**/dashboard", timeout=30000)
        assert _path(page.url) == "/dashboard", (
            f"After login the browser should be on /dashboard, got {page.url}"
        )
        _wait_for_text(page, username)
    finally:
        context.close()


def test_protected_route_redirect_and_return(browser):
    username = _unique_username()
    reg_context, _ = _register(browser, username, PASSWORD)
    reg_context.close()

    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto(BASE_URL + "/dashboard/settings", wait_until="domcontentloaded")
        page.wait_for_url("**/login**", timeout=30000)
        assert _path(page.url) == "/login", (
            f"Unauthenticated access to /dashboard/settings must redirect to /login, got {page.url}"
        )
        qs = parse_qs(urlparse(page.url).query)
        assert "redirect" in qs, (
            f"Login redirect must carry a 'redirect' search param; url was {page.url}"
        )
        redirect_val = unquote(qs["redirect"][0])
        assert redirect_val.rstrip("/") == "/dashboard/settings", (
            f"'redirect' param should be '/dashboard/settings', got {redirect_val!r}"
        )

        _fill_credentials(page, username, PASSWORD)
        _submit(page)
        page.wait_for_url("**/dashboard/settings", timeout=30000)
        assert _path(page.url) == "/dashboard/settings", (
            f"After login the user should return to /dashboard/settings, got {page.url}"
        )
    finally:
        context.close()


def test_wrong_password_is_rejected(browser):
    username = _unique_username()
    reg_context, _ = _register(browser, username, PASSWORD)
    reg_context.close()

    context = browser.new_context()
    page = context.new_page()
    try:
        page.goto(BASE_URL + "/login", wait_until="domcontentloaded")
        _fill_credentials(page, username, WRONG_PASSWORD)
        _submit(page)
        # Give the app a moment to (not) authenticate.
        page.wait_for_timeout(3000)
        assert _path(page.url) == "/login", (
            f"Wrong password must not navigate away from /login, got {page.url}"
        )
        # Confirm the user is genuinely unauthenticated.
        page.goto(BASE_URL + "/dashboard", wait_until="domcontentloaded")
        page.wait_for_url("**/login**", timeout=30000)
        assert _path(page.url) == "/login", (
            f"After a failed login, /dashboard must redirect to /login, got {page.url}"
        )
    finally:
        context.close()


def test_password_stored_hashed_not_plaintext(browser):
    username = _unique_username()
    context, _ = _register(browser, username, PASSWORD)
    context.close()

    assert os.path.isfile(DB_PATH), f"SQLite database not found at {DB_PATH}."

    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    except sqlite3.OperationalError:
        conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA busy_timeout = 8000")
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        assert tables, "No tables found in the SQLite database."

        collected = []
        for table in tables:
            if table.startswith("sqlite_"):
                continue
            try:
                rows = conn.execute(f'SELECT * FROM "{table}"').fetchall()
            except sqlite3.DatabaseError:
                continue
            for row in rows:
                for value in row:
                    if isinstance(value, bytes):
                        try:
                            value = value.decode("utf-8", "ignore")
                        except Exception:
                            continue
                    if isinstance(value, str):
                        collected.append(value)

        haystack = "\n".join(collected)
        assert username in haystack, (
            f"Registered username '{username}' was not found in the database; "
            "the user does not appear to be persisted in SQLite."
        )
        assert PASSWORD not in haystack, (
            "The plaintext password was found stored in the database; passwords must "
            "be hashed, not stored in plaintext."
        )
    finally:
        conn.close()
