import os
import re
import socket
import subprocess
from pathlib import Path

import pytest
import requests
from pochi_verifier import PochiVerifier
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"
BASE_URL = "http://localhost:5173"


# ---------------------------------------------------------------------------
# App lifecycle fixture
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK dev server via `npm run dev` and wait for port 5173."""

    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(2)
                    if s.connect_ex(("localhost", 5173)) != 0:
                        return False
                # also ensure HTTP responds
                r = requests.get(BASE_URL + "/login", timeout=5)
                return r.status_code < 500
            except Exception:
                return False

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_set_cookie_session(set_cookie_headers):
    """Find the Set-Cookie header that sets the `session` cookie.

    Returns the full header value or None.
    """
    if isinstance(set_cookie_headers, str):
        candidates = [set_cookie_headers]
    else:
        candidates = list(set_cookie_headers or [])
    for hdr in candidates:
        if re.match(r"^\s*session\s*=", hdr, re.IGNORECASE):
            return hdr
    return None


def _all_set_cookie(response):
    """Return list of all Set-Cookie header values from a requests Response."""
    # requests collapses headers, but raw.headers preserves duplicates if available
    raw = response.raw.headers if response.raw is not None else None
    if raw is not None and hasattr(raw, "getlist"):
        return raw.getlist("Set-Cookie")
    # Fallback: split combined value (works because rwsdk sets one cookie)
    sc = response.headers.get("Set-Cookie")
    return [sc] if sc else []


# ---------------------------------------------------------------------------
# Source-code structural check (interrupter pattern usage)
# ---------------------------------------------------------------------------
def test_source_uses_interrupter_pattern_for_dashboard():
    src_dir = Path(PROJECT_DIR) / "src"
    assert src_dir.is_dir(), f"Expected source directory {src_dir} to exist."

    # Look for a route("/dashboard", [ ... ]) call (array form = interrupter pattern).
    pattern = re.compile(
        r"""route\(\s*['"]/dashboard['"]\s*,\s*\[""",
        re.IGNORECASE,
    )
    found = False
    matched_file = None
    for path in src_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if pattern.search(text):
            found = True
            matched_file = str(path)
            break

    assert found, (
        "Could not find an rwsdk interrupter-style route definition for /dashboard "
        "(expected `route(\"/dashboard\", [<interrupter>, <handler>])`) under src/."
    )
    assert matched_file is not None


# ---------------------------------------------------------------------------
# HTTP behavior checks
# ---------------------------------------------------------------------------
def test_unauthenticated_dashboard_redirects_to_login(start_app):
    r = requests.get(BASE_URL + "/dashboard", allow_redirects=False, timeout=15)
    assert r.status_code == 302, (
        f"Expected 302 redirect for unauthenticated /dashboard, got {r.status_code}."
    )
    location = r.headers.get("Location", "")
    assert location.endswith("/login") or location == "/login", (
        f"Expected Location header to be /login, got '{location}'."
    )


def test_login_page_renders_form(start_app):
    r = requests.get(BASE_URL + "/login", allow_redirects=False, timeout=15)
    assert r.status_code == 200, f"Expected 200 for GET /login, got {r.status_code}."
    body = r.text
    assert re.search(r"<form\b[^>]*method\s*=\s*['\"]?post['\"]?", body, re.IGNORECASE), (
        "Login page must include an HTML <form> with method=\"post\"."
    )
    assert re.search(r"<input\b[^>]*\bname\s*=\s*['\"]username['\"]", body, re.IGNORECASE), (
        "Login form must include an <input name=\"username\">."
    )
    assert re.search(r"<input\b[^>]*\bname\s*=\s*['\"]password['\"]", body, re.IGNORECASE), (
        "Login form must include an <input name=\"password\">."
    )


def test_invalid_login_returns_401_and_no_session_cookie(start_app):
    r = requests.post(
        BASE_URL + "/login",
        data={"username": "demo", "password": "wrong"},
        allow_redirects=False,
        timeout=15,
    )
    assert r.status_code == 401, (
        f"Expected 401 for invalid credentials, got {r.status_code}."
    )
    assert re.search(r"invalid", r.text, re.IGNORECASE), (
        "Invalid-login response body must contain a human-readable error (e.g. 'invalid')."
    )
    cookies = _all_set_cookie(r)
    sc = _parse_set_cookie_session(cookies)
    if sc is not None:
        # Allow an explicit empty/clearing cookie, but reject a set with a value.
        value_part = sc.split("=", 1)[1].split(";", 1)[0].strip()
        assert value_part == "", (
            f"Invalid login must NOT set a populated session cookie; got Set-Cookie: {sc}"
        )


def _login_and_capture_cookie():
    r = requests.post(
        BASE_URL + "/login",
        data={"username": "demo", "password": "pass"},
        allow_redirects=False,
        timeout=15,
    )
    return r


def test_valid_login_sets_signed_session_cookie(start_app):
    r = _login_and_capture_cookie()
    assert r.status_code == 302, (
        f"Expected 302 redirect on successful login, got {r.status_code}."
    )
    assert r.headers.get("Location", "") in {"/dashboard", BASE_URL + "/dashboard"}, (
        f"Expected Location: /dashboard after successful login, got '{r.headers.get('Location')}'."
    )

    cookies = _all_set_cookie(r)
    sc = _parse_set_cookie_session(cookies)
    assert sc is not None, (
        f"Expected a Set-Cookie header for `session` after successful login. Headers: {cookies}"
    )
    value_part = sc.split("=", 1)[1].split(";", 1)[0].strip()
    assert value_part, "session cookie value must be non-empty after successful login."
    assert re.search(r"HttpOnly", sc, re.IGNORECASE), (
        f"session cookie must include HttpOnly attribute. Got: {sc}"
    )
    assert re.search(r"Path\s*=\s*/", sc, re.IGNORECASE), (
        f"session cookie must include Path=/ attribute. Got: {sc}"
    )
    # signed cookies usually have a separator between payload and signature
    assert re.search(r"[.:|]", value_part), (
        f"session cookie value should contain a separator (.|:|) between payload and signature; "
        f"got: {value_part!r}"
    )


def test_authenticated_dashboard_shows_username(start_app):
    s = requests.Session()
    login = s.post(
        BASE_URL + "/login",
        data={"username": "demo", "password": "pass"},
        allow_redirects=False,
        timeout=15,
    )
    assert login.status_code == 302, f"Login failed: status={login.status_code}"
    assert "session" in s.cookies, "Login did not place a `session` cookie in the client jar."

    r = s.get(BASE_URL + "/dashboard", allow_redirects=False, timeout=15)
    assert r.status_code == 200, (
        f"Expected 200 for authenticated /dashboard, got {r.status_code}."
    )
    assert "demo" in r.text, (
        "Authenticated dashboard page must contain the username 'demo' in its body."
    )


def test_tampered_cookie_is_rejected(start_app):
    s = requests.Session()
    login = s.post(
        BASE_URL + "/login",
        data={"username": "demo", "password": "pass"},
        allow_redirects=False,
        timeout=15,
    )
    assert login.status_code == 302
    raw_value = s.cookies.get("session")
    assert raw_value, "Expected a session cookie after login."

    # Flip the last character to invalidate the signature
    last = raw_value[-1]
    flipped = "0" if last != "0" else "1"
    tampered = raw_value[:-1] + flipped

    r = requests.get(
        BASE_URL + "/dashboard",
        cookies={"session": tampered},
        allow_redirects=False,
        timeout=15,
    )
    assert r.status_code == 302, (
        f"Tampered cookie must NOT grant access; expected 302 redirect, got {r.status_code}."
    )
    location = r.headers.get("Location", "")
    assert location.endswith("/login") or location == "/login", (
        f"Tampered-cookie request should redirect to /login; got '{location}'."
    )


def test_logout_clears_cookie_and_blocks_dashboard(start_app):
    s = requests.Session()
    login = s.post(
        BASE_URL + "/login",
        data={"username": "demo", "password": "pass"},
        allow_redirects=False,
        timeout=15,
    )
    assert login.status_code == 302

    logout = s.post(BASE_URL + "/logout", allow_redirects=False, timeout=15)
    assert logout.status_code == 302, (
        f"Expected 302 on /logout, got {logout.status_code}."
    )
    assert logout.headers.get("Location", "").endswith("/login"), (
        f"Logout should redirect to /login; got '{logout.headers.get('Location')}'."
    )

    cookies = _all_set_cookie(logout)
    sc = _parse_set_cookie_session(cookies)
    assert sc is not None, "Logout must set a Set-Cookie header that clears the session cookie."
    cleared = (
        re.search(r"Max-Age\s*=\s*0", sc, re.IGNORECASE) is not None
        or re.search(r"Expires\s*=\s*\w{3},\s*\d{2}\s+\w{3}\s+19[6-9]\d|20[01]\d", sc) is not None
        or re.match(r"^\s*session\s*=\s*(;|$)", sc, re.IGNORECASE) is not None
    )
    assert cleared, (
        f"Logout cookie must be cleared (Max-Age=0, past Expires, or empty value). Got: {sc}"
    )

    # After logout the jar's cookie may still exist client-side until rejected;
    # follow up with a fresh request that omits the cookie entirely to confirm
    # /dashboard still redirects when unauthenticated.
    r = requests.get(BASE_URL + "/dashboard", allow_redirects=False, timeout=15)
    assert r.status_code == 302 and r.headers.get("Location", "").endswith("/login"), (
        "After logout, /dashboard must redirect unauthenticated visitors to /login."
    )


# ---------------------------------------------------------------------------
# Browser verification
# ---------------------------------------------------------------------------
def test_browser_full_flow(start_app):
    reason = (
        "The /dashboard route must be protected by an rwsdk interrupter. Unauthenticated "
        "browser visits must be redirected to /login. After logging in with demo / pass, the "
        "user should land on /dashboard and see their username. Logging out must redirect to "
        "/login and revoke access."
    )
    truth = (
        "Open a fresh browser context (no cookies). Navigate to http://localhost:5173/dashboard. "
        "Expected: the browser ends up at /login and the login form is visible. "
        "Fill the form fields named 'username' with 'demo' and 'password' with 'pass', then "
        "submit the form. Expected: the browser navigates to /dashboard and the visible page "
        "text contains 'demo'. Then trigger logout (click a Logout button if present, or "
        "navigate the browser so it submits a POST to http://localhost:5173/logout). Expected: "
        "the browser is redirected back to /login. Finally, navigate again to "
        "http://localhost:5173/dashboard. Expected: the browser is once again redirected to "
        "/login."
    )

    verifier = PochiVerifier()
    result = verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_full_flow",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
