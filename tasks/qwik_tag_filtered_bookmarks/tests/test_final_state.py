import os
import socket
import sqlite3
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/qwik-app"
DB_PATH = "/home/user/qwik-app/data/bookmarks.db"
PORT = 5173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects -> the readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api/bookmarks"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def post_bookmark(payload):
    return requests.post(API_URL, json=payload, timeout=30)


def get_bookmarks(tags=None):
    params = [("tag", t) for t in (tags or [])]
    return requests.get(API_URL, params=params, timeout=30)


def read_db(query, args=()):
    """Read from the SQLite DB in read-only mode with a small retry loop."""
    last_err = None
    for _ in range(10):
        try:
            conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=5)
            try:
                cur = conn.execute(query, args)
                return cur.fetchall()
            finally:
                conn.close()
        except sqlite3.OperationalError as e:  # database locked / not ready
            last_err = e
            time.sleep(0.5)
    raise AssertionError(f"Could not read from DB {DB_PATH}: {last_err}")


def assert_bookmark_shape(obj):
    assert isinstance(obj, dict), f"Bookmark is not a JSON object: {obj!r}"
    assert set(obj.keys()) == {"id", "url", "title", "tags"}, (
        f"Bookmark object must have exactly keys id/url/title/tags, got {sorted(obj.keys())}"
    )
    assert isinstance(obj["id"], int), f"'id' must be a number, got {obj['id']!r}"
    assert isinstance(obj["url"], str), f"'url' must be a string, got {obj['url']!r}"
    assert isinstance(obj["title"], str), f"'title' must be a string, got {obj['title']!r}"
    assert isinstance(obj["tags"], list), f"'tags' must be an array, got {obj['tags']!r}"


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", str(PORT)]
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
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
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
        print(f"===================== [{tag}: Begin] {Starter.name} log =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {Starter.name} log =====================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def seeded(start_app):
    """Create the base data set through the JSON API and return created ids."""
    created = {}

    r = post_bookmark({"url": "https://qwik.dev", "title": "Qwik", "tags": ["js", "web", "framework"]})
    assert r.status_code == 201, f"Creating 'Qwik' should return 201, got {r.status_code}: {r.text}"
    body = r.json()
    assert_bookmark_shape(body)
    assert body["url"] == "https://qwik.dev" and body["title"] == "Qwik", f"Unexpected body: {body}"
    assert body["tags"] == ["framework", "js", "web"], f"Tags must be sorted ascending, got {body['tags']}"
    created["Qwik"] = body

    r = post_bookmark({"url": "https://vitejs.dev", "title": "Vite", "tags": ["js", "web"]})
    assert r.status_code == 201, f"Creating 'Vite' should return 201, got {r.status_code}: {r.text}"
    body = r.json()
    assert_bookmark_shape(body)
    assert body["tags"] == ["js", "web"], f"Expected tags ['js','web'], got {body['tags']}"
    created["Vite"] = body

    r = post_bookmark({"url": "https://sqlite.org", "title": "SQLite", "tags": ["db"]})
    assert r.status_code == 201, f"Creating 'SQLite' should return 201, got {r.status_code}: {r.text}"
    body = r.json()
    assert_bookmark_shape(body)
    assert body["tags"] == ["db"], f"Expected tags ['db'], got {body['tags']}"
    created["SQLite"] = body

    r = post_bookmark({"url": "https://example.com", "title": "NoTags", "tags": []})
    assert r.status_code == 201, f"Creating 'NoTags' should return 201, got {r.status_code}: {r.text}"
    body = r.json()
    assert_bookmark_shape(body)
    assert body["tags"] == [], f"Expected empty tags, got {body['tags']}"
    created["NoTags"] = body

    # Duplicate tag names within one request must be collapsed.
    r = post_bookmark({"url": "https://dup.example", "title": "Dup", "tags": ["js", "js", "web"]})
    assert r.status_code == 201, f"Creating 'Dup' should return 201, got {r.status_code}: {r.text}"
    body = r.json()
    assert_bookmark_shape(body)
    assert body["tags"] == ["js", "web"], f"Duplicate tags must collapse to ['js','web'], got {body['tags']}"
    created["Dup"] = body

    return created


# --------------------------------------------------------------------------- #
# Schema / relational model
# --------------------------------------------------------------------------- #
def test_database_file_exists(seeded):
    assert os.path.isfile(DB_PATH), f"SQLite database not found at {DB_PATH}"


def test_three_tables_exist(seeded):
    rows = read_db("SELECT name FROM sqlite_master WHERE type='table'")
    names = {r[0] for r in rows}
    for table in ("bookmarks", "tags", "bookmark_tags"):
        assert table in names, f"Expected table '{table}' to exist, found tables: {sorted(names)}"


def test_bookmarks_table_columns(seeded):
    cols = {r[1] for r in read_db("PRAGMA table_info(bookmarks)")}
    for col in ("id", "url", "title"):
        assert col in cols, f"'bookmarks' table must have column '{col}', found: {sorted(cols)}"


def test_tags_table_columns(seeded):
    cols = {r[1] for r in read_db("PRAGMA table_info(tags)")}
    for col in ("id", "name"):
        assert col in cols, f"'tags' table must have column '{col}', found: {sorted(cols)}"


# --------------------------------------------------------------------------- #
# Tag reuse (no duplicate tag rows)
# --------------------------------------------------------------------------- #
def test_shared_tags_are_not_duplicated(seeded):
    for name in ("js", "web", "framework", "db"):
        rows = read_db("SELECT COUNT(*) FROM tags WHERE name = ?", (name,))
        count = rows[0][0]
        assert count == 1, (
            f"Tag '{name}' must be stored exactly once (reused across bookmarks), found {count} rows"
        )


# --------------------------------------------------------------------------- #
# AND-semantics filtering via JSON API
# --------------------------------------------------------------------------- #
def test_filter_two_tags_and_semantics(seeded):
    r = get_bookmarks(["js", "web"])
    assert r.status_code == 200, f"GET with tags js,web should return 200, got {r.status_code}"
    data = r.json()
    titles = [b["title"] for b in data]
    assert titles == ["Qwik", "Vite", "Dup"], (
        f"Filtering by js AND web must return exactly Qwik, Vite, Dup ordered by id, got {titles}"
    )


def test_filter_three_tags(seeded):
    r = get_bookmarks(["js", "web", "framework"])
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    titles = [b["title"] for b in r.json()]
    assert titles == ["Qwik"], f"Filtering by js AND web AND framework must return only Qwik, got {titles}"


def test_filter_single_tag(seeded):
    r = get_bookmarks(["db"])
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    titles = [b["title"] for b in r.json()]
    assert titles == ["SQLite"], f"Filtering by db must return only SQLite, got {titles}"


def test_filter_nonexistent_tag(seeded):
    r = get_bookmarks(["nonexistent"])
    assert r.status_code == 200, f"Expected 200, got {r.status_code}"
    assert r.json() == [], f"Filtering by an unused tag must return an empty array, got {r.json()}"


def test_list_all_bookmarks(seeded):
    r = get_bookmarks()
    assert r.status_code == 200, f"GET without tag param should return 200, got {r.status_code}"
    data = r.json()
    for obj in data:
        assert_bookmark_shape(obj)
    ids = [b["id"] for b in data]
    assert ids == sorted(ids), f"Bookmarks must be ordered by id ascending, got {ids}"
    by_url = {b["url"]: b for b in data}
    expected = {
        "https://qwik.dev": ["framework", "js", "web"],
        "https://vitejs.dev": ["js", "web"],
        "https://sqlite.org": ["db"],
        "https://example.com": [],
        "https://dup.example": ["js", "web"],
    }
    for url, tags in expected.items():
        assert url in by_url, f"Expected bookmark with url {url} to be present. Got urls: {list(by_url)}"
        assert by_url[url]["tags"] == tags, (
            f"Bookmark {url} must have tags {tags}, got {by_url[url]['tags']}"
        )
    assert len(data) == 5, f"Expected exactly 5 bookmarks before any UI creation, got {len(data)}"


# --------------------------------------------------------------------------- #
# Input validation (negative / zero side effects)
# --------------------------------------------------------------------------- #
def test_missing_url_rejected(seeded):
    before = len(get_bookmarks().json())
    r = post_bookmark({"title": "Missing URL", "tags": ["x"]})
    assert r.status_code == 400, f"Missing url must return 400, got {r.status_code}: {r.text}"
    after = len(get_bookmarks().json())
    assert after == before, f"Rejected request must not create anything (before={before}, after={after})"


def test_empty_url_and_title_rejected(seeded):
    before = len(get_bookmarks().json())
    r = post_bookmark({"url": "", "title": "", "tags": []})
    assert r.status_code == 400, f"Empty url/title must return 400, got {r.status_code}: {r.text}"
    after = len(get_bookmarks().json())
    assert after == before, f"Rejected request must not create anything (before={before}, after={after})"


# --------------------------------------------------------------------------- #
# Browser verification of routeLoader$ filtering
# --------------------------------------------------------------------------- #
def test_browser_loader_filters_by_tags(seeded, browser_verifier):
    reason = (
        "The home page uses a routeLoader$ that reads the repeatable `tag` query parameter "
        "and renders only the bookmarks that carry ALL of the requested tags."
    )
    truth = (
        f"Navigate to {BASE_URL}/?tag=js&tag=web . Verify that the page lists exactly three "
        "bookmarks whose titles are 'Qwik', 'Vite', and 'Dup' (in any order). Verify that the "
        "titles 'SQLite' and 'NoTags' do NOT appear anywhere in the bookmark list."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_loader_filters_by_tags",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


# --------------------------------------------------------------------------- #
# Browser verification of routeAction$ create form (defined last: it adds data)
# --------------------------------------------------------------------------- #
def test_browser_action_creates_bookmark(seeded, browser_verifier):
    reason = (
        "The home page has a Qwik City <Form> bound to a routeAction$ that creates a new "
        "bookmark together with its tags."
    )
    truth = (
        f"Navigate to {BASE_URL}/ . Fill the form field named 'url' with "
        "'https://developer.mozilla.org', the field named 'title' with 'MDN', and the field "
        "named 'tags' with 'web,docs'. Submit the form. After submission, verify that a bookmark "
        "titled 'MDN' is shown on the page."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_action_creates_bookmark",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    # Confirm the persisted state through the API and its many-to-many join.
    r = get_bookmarks(["docs"])
    assert r.status_code == 200, f"Expected 200 filtering by docs, got {r.status_code}"
    data = r.json()
    assert len(data) == 1, f"Filtering by 'docs' must return exactly the newly created bookmark, got {data}"
    obj = data[0]
    assert_bookmark_shape(obj)
    assert obj["title"] == "MDN", f"Expected title 'MDN', got {obj['title']}"
    assert obj["url"] == "https://developer.mozilla.org", f"Unexpected url: {obj['url']}"
    assert obj["tags"] == ["docs", "web"], f"Expected tags ['docs','web'] (sorted), got {obj['tags']}"
