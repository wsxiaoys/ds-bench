import os
import socket
import subprocess
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin

import pytest
import requests
from bs4 import BeautifulSoup
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/qwik-app"
DB_PATH = "/home/user/qwik-app/data/comments.db"
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects -> readiness checks would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
# Qwik City enforces CSRF protection on form-action POSTs by checking Origin.
HEADERS = {"Origin": BASE_URL}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def get_soup():
    resp = requests.get(BASE_URL, timeout=30)
    assert resp.status_code == 200, f"GET / returned {resp.status_code}"
    return BeautifulSoup(resp.text, "html.parser")


def comment_elements(soup):
    return soup.select('[data-testid="comment"]')


def find_node_by_body(soup, body):
    """Return the (most specific) comment element whose own body is `body`.

    Ancestor nodes also contain the descendant text, so among all comment
    elements that contain `body` we pick the one with the greatest depth.
    """
    candidates = [el for el in comment_elements(soup) if body in el.get_text()]
    if not candidates:
        return None

    def depth(el):
        try:
            return int(el.get("data-depth", "-1"))
        except (TypeError, ValueError):
            return -1

    return max(candidates, key=depth)


def get_action_url(soup):
    form = soup.find(attrs={"data-testid": "reply-form"})
    assert form is not None, "No reply form (data-testid='reply-form') found on the page."
    action = form.get("action")
    assert action, "Reply form is missing an 'action' attribute."
    return urljoin(BASE_URL, action)


def db_count():
    result = subprocess.run(
        ["sqlite3", DB_PATH, "SELECT COUNT(*) FROM comments;"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"sqlite3 count query failed: {result.stderr}"
    return int(result.stdout.strip())


def post_reply(action_url, parent_id, author, body):
    return requests.post(
        action_url,
        data={"parentId": str(parent_id), "author": author, "body": body},
        headers=HEADERS,
        timeout=30,
    )


# --------------------------------------------------------------------------- #
# Long-running Qwik dev server
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session", autouse=True)
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "qwik_app"
        args = ["npm", "run", "dev", "--", "--port", str(PORT), "--host", HOST]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=30)
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
        print(f"===== [{tag}] end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


# --------------------------------------------------------------------------- #
# 1. Seed tree renders (routeLoader$ + recursive component)
# --------------------------------------------------------------------------- #
def test_seed_tree_renders_nested():
    soup = get_soup()

    great = find_node_by_body(soup, "Great article!")
    agree = find_node_by_body(soup, "I agree.")
    well = find_node_by_body(soup, "Well said.")
    updates = find_node_by_body(soup, "Any updates?")

    for name, node in [
        ("Great article!", great),
        ("I agree.", agree),
        ("Well said.", well),
        ("Any updates?", updates),
    ]:
        assert node is not None, f"Seed comment '{name}' not rendered as a data-testid='comment' node."

    # Roots
    assert great.get("data-depth") == "0", "Root comment 'Great article!' must have data-depth='0'."
    assert (great.get("data-parent-id") or "") == "", "Root comment must have an empty data-parent-id."
    assert updates.get("data-depth") == "0", "Root comment 'Any updates?' must have data-depth='0'."
    assert (updates.get("data-parent-id") or "") == "", "Root comment must have an empty data-parent-id."

    # Depth 1 child linked to its parent
    assert agree.get("data-depth") == "1", "'I agree.' must have data-depth='1'."
    assert agree.get("data-parent-id") == great.get("data-comment-id"), (
        "'I agree.' data-parent-id must equal the data-comment-id of 'Great article!'."
    )

    # Depth 2 grandchild, DOM nesting reflects the tree
    assert well.get("data-depth") == "2", "'Well said.' must have data-depth='2'."
    assert agree.find(attrs={"data-comment-id": well.get("data-comment-id")}) is not None, (
        "'Well said.' must be a DOM descendant of 'I agree.'."
    )
    assert great.find(attrs={"data-comment-id": agree.get("data-comment-id")}) is not None, (
        "'I agree.' must be a DOM descendant of 'Great article!'."
    )


# --------------------------------------------------------------------------- #
# 2. Database schema and seed rows
# --------------------------------------------------------------------------- #
def test_database_schema():
    result = subprocess.run(
        ["sqlite3", DB_PATH, ".schema comments"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Failed to read schema: {result.stderr}"
    schema = result.stdout.lower()
    assert "create table" in schema and "comments" in schema, "No 'comments' table found."
    for col in ["id", "parent_id", "author", "body", "created_at"]:
        assert col in schema, f"Column '{col}' missing from the comments table schema."


def test_seed_row_count():
    assert db_count() == 4, "Expected exactly 4 seeded comment rows on a fresh database."


# --------------------------------------------------------------------------- #
# 3. Post a valid reply to a root (routeAction$)
# --------------------------------------------------------------------------- #
def test_reply_to_root():
    soup = get_soup()
    pid = find_node_by_body(soup, "Great article!").get("data-comment-id")
    action_url = get_action_url(soup)
    before = db_count()

    resp = post_reply(action_url, pid, "erin", "Nice point!")
    assert resp.status_code < 400, f"Reply POST failed with status {resp.status_code}."

    assert db_count() == before + 1, "A valid reply must insert exactly one new row."

    soup2 = get_soup()
    node = find_node_by_body(soup2, "Nice point!")
    assert node is not None, "New reply 'Nice point!' was not rendered after posting."
    assert node.get("data-parent-id") == pid, "'Nice point!' must be parented to 'Great article!'."
    assert node.get("data-depth") == "1", "'Nice point!' must render at data-depth='1'."


# --------------------------------------------------------------------------- #
# 4. Reply to a deep node (arbitrary depth)
# --------------------------------------------------------------------------- #
def test_reply_to_deep_node():
    soup = get_soup()
    did = find_node_by_body(soup, "Well said.").get("data-comment-id")
    action_url = get_action_url(soup)

    resp = post_reply(action_url, did, "frank", "+1")
    assert resp.status_code < 400, f"Deep reply POST failed with status {resp.status_code}."

    soup2 = get_soup()
    node = find_node_by_body(soup2, "+1")
    assert node is not None, "Deep reply '+1' was not rendered after posting."
    assert node.get("data-parent-id") == did, "'+1' must be parented to 'Well said.'."
    assert node.get("data-depth") == "3", "'+1' must render at data-depth='3' (parent depth 2 + 1)."


# --------------------------------------------------------------------------- #
# 5. Zod validation failure (no insert)
# --------------------------------------------------------------------------- #
def test_validation_rejects_short_author():
    soup = get_soup()
    action_url = get_action_url(soup)
    before = db_count()

    resp = post_reply(action_url, "", "x", "hello")
    result = BeautifulSoup(resp.text, "html.parser")
    assert result.find(attrs={"data-testid": "error"}) is not None, (
        "An overly short author must produce a data-testid='error' element."
    )
    assert db_count() == before, "A validation failure must not insert any row."


def test_validation_rejects_empty_body():
    soup = get_soup()
    action_url = get_action_url(soup)
    before = db_count()

    resp = post_reply(action_url, "", "validname", "")
    result = BeautifulSoup(resp.text, "html.parser")
    assert result.find(attrs={"data-testid": "error"}) is not None, (
        "An empty body must produce a data-testid='error' element."
    )
    assert db_count() == before, "A validation failure must not insert any row."


# --------------------------------------------------------------------------- #
# 6. Invalid parent rejected
# --------------------------------------------------------------------------- #
def test_invalid_parent_rejected():
    soup = get_soup()
    action_url = get_action_url(soup)
    before = db_count()

    post_reply(action_url, "999999", "zoe", "ghost")

    assert db_count() == before, "Replying to a non-existent parent must not insert any row."
    soup2 = get_soup()
    assert find_node_by_body(soup2, "ghost") is None, "Rejected reply 'ghost' must not appear on the page."


# --------------------------------------------------------------------------- #
# 7. Concurrent replies all persist
# --------------------------------------------------------------------------- #
def test_concurrent_replies_all_persist():
    soup = get_soup()
    bid = find_node_by_body(soup, "Any updates?").get("data-comment-id")
    action_url = get_action_url(soup)
    before = db_count()

    bodies = [f"msg-{i}" for i in range(10)]

    def submit(body):
        return post_reply(action_url, bid, "user", body).status_code

    with ThreadPoolExecutor(max_workers=10) as pool:
        statuses = list(pool.map(submit, bodies))

    assert all(s < 400 for s in statuses), f"Some concurrent replies failed: {statuses}"
    assert db_count() == before + 10, "All 10 concurrent replies must be persisted (exactly 10 new rows)."

    soup2 = get_soup()
    for body in bodies:
        node = find_node_by_body(soup2, body)
        assert node is not None, f"Concurrent reply '{body}' was not rendered."
        assert node.get("data-parent-id") == bid, f"'{body}' must be parented to 'Any updates?'."
        assert node.get("data-depth") == "1", f"'{body}' must render at data-depth='1'."
