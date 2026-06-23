import os
import re
import socket

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myapp"
BASE_URL = "http://localhost:5173"


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "rwsdk_dev"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 5173)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()


def test_links_module_exists(start_app):
    expected = "/home/user/myapp/src/app/shared/links.ts"
    assert os.path.isfile(expected), f"Expected typed link helper at {expected}."
    with open(expected) as f:
        body = f.read()
    assert "linkFor" in body, "links.ts must use `linkFor` from rwsdk/router."
    assert re.search(r"export\s+const\s+link\b", body), \
        "links.ts must export a `link` constant."


def _anchor_pattern(href: str, text: str) -> re.Pattern:
    return re.compile(
        r'<a[^>]*href=["\']' + re.escape(href) + r'["\'][^>]*>\s*' + re.escape(text) + r'\s*</a>',
        re.IGNORECASE,
    )


def test_home_links(start_app):
    r = requests.get(f"{BASE_URL}/home", timeout=30)
    assert r.status_code == 200, f"GET /home returned {r.status_code}: {r.text[:300]}"
    assert _anchor_pattern("/about", "About").search(r.text), \
        f"Missing typed link to /about labelled 'About'. Body: {r.text[:600]}"
    assert _anchor_pattern("/users/42", "Show user 42").search(r.text), \
        f"Missing typed link to /users/42 labelled 'Show user 42'. Body: {r.text[:600]}"


def test_about_link_back(start_app):
    r = requests.get(f"{BASE_URL}/about", timeout=30)
    assert r.status_code == 200
    assert _anchor_pattern("/home", "Back to home").search(r.text), \
        f"Missing typed link back to /home. Body: {r.text[:600]}"


@pytest.mark.parametrize("uid", ["42", "redwood"])
def test_user_profile_route(start_app, uid):
    r = requests.get(f"{BASE_URL}/users/{uid}", timeout=30)
    assert r.status_code == 200
    assert f"User profile: {uid}" in r.text, \
        f"Expected 'User profile: {uid}' in /users/{uid} body."
