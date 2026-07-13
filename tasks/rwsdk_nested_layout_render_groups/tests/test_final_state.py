import os
import re
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
BASE_URL = "http://127.0.0.1:5173"


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the RedwoodSDK (Vite) dev server and wait until port 5173 is open."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "127.0.0.1"]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 5173)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"===================== [{tag}: Begin] {Starter.name} logfile =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} logfile =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def fetch(path):
    """Fetch a page, tolerating the dev server's first-request on-demand compilation."""
    url = BASE_URL + path
    last_err = None
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            resp = requests.get(url, timeout=60)
            return resp
        except requests.RequestException as e:  # pragma: no cover - transient
            last_err = e
            time.sleep(2)
    raise AssertionError(f"Could not fetch {url}: {last_err}")


def get_title(html):
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else None


def has_testid(html, testid):
    return f'data-testid="{testid}"' in html


# ---------- Public section ----------

def test_public_home(start_app):
    resp = fetch("/")
    assert resp.status_code == 200, f"GET / returned {resp.status_code}"
    html = resp.text
    assert get_title(html) == "Public Site", (
        f"Expected document <title> 'Public Site' on /, got: {get_title(html)!r}"
    )
    assert has_testid(html, "public-layout"), "Missing data-testid='public-layout' on /"
    assert has_testid(html, "public-nav"), "Missing data-testid='public-nav' on /"
    assert 'href="/about"' in html and "About" in html, (
        "Public nav must link to /about with text 'About'"
    )
    assert 'href="/"' in html and "Home" in html, (
        "Public nav must link to / with text 'Home'"
    )
    assert has_testid(html, "page-home"), "Missing data-testid='page-home' on /"
    assert "Welcome Home" in html, "Home page must include text 'Welcome Home'"
    assert not has_testid(html, "admin-nav"), "Public / must NOT include admin-nav chrome"


def test_public_about(start_app):
    resp = fetch("/about")
    assert resp.status_code == 200, f"GET /about returned {resp.status_code}"
    html = resp.text
    assert get_title(html) == "Public Site", (
        f"Expected document <title> 'Public Site' on /about, got: {get_title(html)!r}"
    )
    assert has_testid(html, "public-nav"), "Missing data-testid='public-nav' on /about"
    assert has_testid(html, "page-about"), "Missing data-testid='page-about' on /about"
    assert "About Us" in html, "About page must include text 'About Us'"
    assert not has_testid(html, "admin-nav"), "Public /about must NOT include admin-nav chrome"


# ---------- Admin section ----------

def test_admin_dashboard(start_app):
    resp = fetch("/admin")
    assert resp.status_code == 200, f"GET /admin returned {resp.status_code}"
    html = resp.text
    assert get_title(html) == "Admin Console", (
        f"Expected document <title> 'Admin Console' on /admin, got: {get_title(html)!r}"
    )
    assert has_testid(html, "admin-layout"), "Missing data-testid='admin-layout' on /admin"
    assert has_testid(html, "admin-nav"), "Missing data-testid='admin-nav' on /admin"
    assert 'href="/admin"' in html and "Dashboard" in html, (
        "Admin nav must link to /admin with text 'Dashboard'"
    )
    assert 'href="/admin/users"' in html and "Users" in html, (
        "Admin nav must link to /admin/users with text 'Users'"
    )
    assert 'href="/admin/settings"' in html and "Settings" in html, (
        "Admin nav must link to /admin/settings with text 'Settings'"
    )
    assert has_testid(html, "page-admin-dashboard"), (
        "Missing data-testid='page-admin-dashboard' on /admin"
    )
    assert "Admin Dashboard" in html, "Admin dashboard must include text 'Admin Dashboard'"
    assert not has_testid(html, "public-nav"), "Admin /admin must NOT include public-nav chrome"


def test_admin_users_nested_shared_layout(start_app):
    resp = fetch("/admin/users")
    assert resp.status_code == 200, f"GET /admin/users returned {resp.status_code}"
    html = resp.text
    assert get_title(html) == "Admin Console", (
        f"Expected document <title> 'Admin Console' on /admin/users, got: {get_title(html)!r}"
    )
    assert has_testid(html, "admin-nav"), (
        "Nested route /admin/users must share the admin layout (data-testid='admin-nav')"
    )
    assert has_testid(html, "page-admin-users"), (
        "Missing data-testid='page-admin-users' on /admin/users"
    )
    assert "Manage Users" in html, "Admin users page must include text 'Manage Users'"
    assert not has_testid(html, "public-nav"), (
        "Admin /admin/users must NOT include public-nav chrome"
    )


def test_admin_settings_nested_shared_layout(start_app):
    resp = fetch("/admin/settings")
    assert resp.status_code == 200, f"GET /admin/settings returned {resp.status_code}"
    html = resp.text
    assert get_title(html) == "Admin Console", (
        f"Expected document <title> 'Admin Console' on /admin/settings, got: {get_title(html)!r}"
    )
    assert has_testid(html, "admin-nav"), (
        "Nested route /admin/settings must share the admin layout (data-testid='admin-nav')"
    )
    assert has_testid(html, "page-admin-settings"), (
        "Missing data-testid='page-admin-settings' on /admin/settings"
    )
    assert "Admin Settings" in html, "Admin settings page must include text 'Admin Settings'"
    assert not has_testid(html, "public-nav"), (
        "Admin /admin/settings must NOT include public-nav chrome"
    )
