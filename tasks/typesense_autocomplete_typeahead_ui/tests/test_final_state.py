import os
import shutil
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/typeahead"
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so a server listening only on 127.0.0.1 would never be
# reachable via `localhost`, causing readiness checks to hang.
HOST = "127.0.0.1"

APP_PORT = 3000
BASE_URL = f"http://{HOST}:{APP_PORT}"

TYPESENSE_BIN = "/usr/local/bin/typesense-server"
TYPESENSE_PORT = 8108
TYPESENSE_URL = f"http://{HOST}:{TYPESENSE_PORT}"
TYPESENSE_DATA_DIR = "/tmp/typesense-verify-data"
with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()


def _capture_logs_factory(name, logpath):
    state = {"printed": 0}

    def capture_logs(tag):
        with open(logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[state["printed"]:]
        skipped = state["printed"]
        state["printed"] = len(all_lines)
        print(f"===================== [{tag}: Begin] {name} logfile =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {name} logfile =====================")

    return capture_logs


@pytest.fixture(scope="session")
def start_typesense(xprocess):
    """Start a fresh, empty Typesense v26.0 server bound to 127.0.0.1:8108."""
    if os.path.isdir(TYPESENSE_DATA_DIR):
        shutil.rmtree(TYPESENSE_DATA_DIR)
    os.makedirs(TYPESENSE_DATA_DIR, exist_ok=True)

    server_env = os.environ.copy()

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            TYPESENSE_BIN,
            f"--data-dir={TYPESENSE_DATA_DIR}",
            f"--api-key={API_KEY}",
            f"--api-port={TYPESENSE_PORT}",
            f"--api-address={HOST}",
            "--enable-cors",
        ]
        env = server_env
        popen_kwargs = {"text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, TYPESENSE_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{TYPESENSE_URL}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    capture_logs = _capture_logs_factory(Starter.name, info.logpath)

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield TYPESENSE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def start_app(xprocess, start_typesense):
    """Install deps and start the typeahead web app, which indexes the dataset on boot."""
    app_env = os.environ.copy()
    app_env["PORT"] = str(APP_PORT)

    # Best-effort dependency install; a project that vendors node_modules still works.
    install = subprocess.run(
        ["npm", "install"],
        cwd=PROJECT_DIR,
        env=app_env,
        capture_output=True,
        text=True,
    )
    print("===================== npm install stdout =====================")
    print(install.stdout)
    print("===================== npm install stderr =====================")
    print(install.stderr)

    class Starter(ProcessStarter):
        name = "typeahead_app"
        args = ["npm", "start"]
        env = app_env
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, APP_PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    capture_logs = _capture_logs_factory(Starter.name, info.logpath)

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
def browser_verifier():
    return PochiVerifier()


def _suggest(q):
    resp = requests.get(f"{BASE_URL}/api/suggest", params={"q": q}, timeout=30)
    return resp


# ----------------------------- API verification -----------------------------


def test_api_cap_and_ordering(start_app):
    """q='s' matches 9 cities but must be capped at 8, ordered by population desc, name asc."""
    resp = _suggest("s")
    assert resp.status_code == 200, f"/api/suggest?q=s returned {resp.status_code}"
    data = resp.json()
    assert isinstance(data, list), "Response must be a JSON array."
    assert len(data) == 8, f"Expected exactly 8 suggestions (capped), got {len(data)}."
    names = [item["name"] for item in data]
    expected = [
        "Santiago",
        "San Antonio",
        "San Diego",
        "San Jose",
        "San Francisco",
        "Seattle",
        "Sacramento",
        "Santa Ana",
    ]
    assert names == expected, f"Expected ordered names {expected}, got {names}."
    assert "Springfield" not in names, (
        "Springfield (lowest population) must be dropped by the 8-item cap."
    )


def test_api_prefix_search_and_schema(start_app):
    """q='san' returns the six prefix matches with the exact key schema and ordering."""
    resp = _suggest("san")
    assert resp.status_code == 200, f"/api/suggest?q=san returned {resp.status_code}"
    data = resp.json()
    names = [item["name"] for item in data]
    expected = [
        "Santiago",
        "San Antonio",
        "San Diego",
        "San Jose",
        "San Francisco",
        "Santa Ana",
    ]
    assert names == expected, f"Expected ordered names {expected}, got {names}."
    for item in data:
        assert set(item.keys()) == {"id", "name", "country", "population"}, (
            f"Each suggestion must have exactly keys id, name, country, population; got {sorted(item.keys())}."
        )
        assert isinstance(item["id"], str), "'id' must be a string."
        assert isinstance(item["population"], int), "'population' must be an integer."


def test_api_typo_tolerance(start_app):
    """A one-character typo ('houstan') must still surface Houston (id '11')."""
    resp = _suggest("houstan")
    assert resp.status_code == 200, f"/api/suggest?q=houstan returned {resp.status_code}"
    data = resp.json()
    matches = [item for item in data if item["name"] == "Houston"]
    assert matches, f"Expected 'Houston' to appear for typo query 'houstan', got {[d['name'] for d in data]}."
    assert matches[0]["id"] == "11", f"Houston should have id '11', got {matches[0]['id']}."


def test_api_empty_and_whitespace(start_app):
    """Empty and whitespace-only queries must return an empty array."""
    empty = _suggest("")
    assert empty.status_code == 200, f"Empty query returned {empty.status_code}"
    assert empty.json() == [], "Empty query must return []."
    ws = _suggest("   ")
    assert ws.status_code == 200, f"Whitespace query returned {ws.status_code}"
    assert ws.json() == [], "Whitespace-only query must return []."


def test_detail_route(start_app):
    """/item/5 shows Santiago/Chile; an unknown id returns 404."""
    ok = requests.get(f"{BASE_URL}/item/5", timeout=30)
    assert ok.status_code == 200, f"/item/5 returned {ok.status_code}"
    body = ok.text
    assert "Santiago" in body, "/item/5 page must contain 'Santiago'."
    assert "Chile" in body, "/item/5 page must contain 'Chile'."
    missing = requests.get(f"{BASE_URL}/item/999", timeout=30)
    assert missing.status_code == 404, (
        f"/item/999 (unknown id) must return 404, got {missing.status_code}."
    )


# --------------------------- Browser verification ---------------------------


def test_browser_prefix_and_highlight(start_app, browser_verifier):
    reason = (
        "Typing a prefix into the search box should show a live dropdown of city "
        "suggestions with the matched letters highlighted."
    )
    truth = (
        f"Navigate to {BASE_URL}/ . Click the search input element that has id 'q' and "
        "type the text 'san'. Wait a moment for a dropdown of suggestions to appear inside "
        "the element with id 'suggestions'. Verify that the first suggestion in the dropdown "
        "contains the text 'Santiago'. Verify that the matched part of the suggestion text is "
        "visually highlighted, i.e. wrapped in a <mark> element, and the highlighted text "
        "(ignoring case) starts with 'san'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_prefix_and_highlight",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_typo_tolerance(start_app, browser_verifier):
    reason = "A query with a single-character typo should still surface the intended city."
    truth = (
        f"Navigate to {BASE_URL}/ . Click the search input element that has id 'q' and type "
        "the text 'houstan'. Wait for the suggestions dropdown to appear. Verify that one of "
        "the suggestions contains the text 'Houston'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_typo_tolerance",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_keyboard_navigation_and_enter(start_app, browser_verifier):
    reason = (
        "The dropdown must support keyboard navigation: ArrowDown activates a suggestion and "
        "Enter opens its detail page."
    )
    truth = (
        f"Navigate to {BASE_URL}/ . Click the search input element that has id 'q' and type "
        "the text 'san'. Wait for the suggestions dropdown to appear. Press the ArrowDown key "
        "once. Verify that exactly one suggestion is now marked active (its element has the CSS "
        "class 'active') and that it is the first suggestion, whose text contains 'Santiago'. "
        "Then press the Enter key. Verify that the browser navigates to a detail page whose URL "
        "ends with '/item/5', and that this detail page shows the text 'Santiago' and the text "
        "'Chile'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_keyboard_navigation_and_enter",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_escape_closes_dropdown(start_app, browser_verifier):
    reason = "Pressing Escape should close the suggestions dropdown."
    truth = (
        f"Navigate to {BASE_URL}/ . Click the search input element that has id 'q' and type "
        "the text 'san'. Wait for the suggestions dropdown to appear with at least one "
        "suggestion visible. Then press the Escape key. Verify that the suggestions dropdown "
        "closes and no suggestion items are visible anymore."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_escape_closes_dropdown",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_clearing_hides_suggestions(start_app, browser_verifier):
    reason = "Clearing the search box should hide all suggestions."
    truth = (
        f"Navigate to {BASE_URL}/ . Click the search input element that has id 'q' and type "
        "the text 'san'. Wait for the suggestions dropdown to appear with at least one "
        "suggestion visible. Then clear the input field so that it is completely empty. Verify "
        "that no suggestion items are visible anymore."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_clearing_hides_suggestions",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
