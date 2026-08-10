import datetime
import os
import socket
import subprocess
import time

import psycopg2
import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/blog"
HOST = "127.0.0.1"
PORT = 3001
BASE_URL = f"http://{HOST}:{PORT}"
OPERATION_URL = f"{BASE_URL}/operations/get-posts"

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ---------------------------------------------------------------------------
# Seed dataset (see the verification plan). Posts 8 and 9 intentionally share
# the same createdAt to exercise the ascending-id tiebreaker.
# ---------------------------------------------------------------------------
TAGS = {"tech": 1, "news": 2, "sports": 3, "food": 4}

POSTS = [
    # id, title, createdAt, tag names
    (1, "Alpha", datetime.datetime(2024, 1, 1, 0, 0, 0), ["tech", "news"]),
    (2, "Bravo", datetime.datetime(2024, 1, 2, 0, 0, 0), ["tech"]),
    (3, "Charlie", datetime.datetime(2024, 1, 3, 0, 0, 0), ["tech", "news", "sports"]),
    (4, "Delta", datetime.datetime(2024, 1, 4, 0, 0, 0), ["news"]),
    (5, "Echo", datetime.datetime(2024, 1, 5, 0, 0, 0), ["tech", "news"]),
    (6, "Foxtrot", datetime.datetime(2024, 1, 6, 0, 0, 0), ["food"]),
    (7, "Golf", datetime.datetime(2024, 1, 7, 0, 0, 0), ["tech", "news", "food"]),
    (8, "Hotel", datetime.datetime(2024, 1, 8, 10, 0, 0), ["tech"]),
    (9, "India", datetime.datetime(2024, 1, 8, 10, 0, 0), ["tech"]),
]


# ---------------------------------------------------------------------------
# Database seeding helpers (seed directly, bypassing the app under test).
# ---------------------------------------------------------------------------
def _discover_join_table(cur):
    """Locate the implicit Post<->Tag many-to-many join table and figure out
    which of its two foreign-key columns references Post and which references Tag."""
    cur.execute(
        """
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        """
    )
    by_table = {}
    for table_name, column_name, foreign_table in cur.fetchall():
        by_table.setdefault(table_name, {})[foreign_table] = column_name

    for table_name, refs in by_table.items():
        if table_name in ("Post", "Tag"):
            continue
        if "Post" in refs and "Tag" in refs:
            return table_name, refs["Post"], refs["Tag"]

    raise AssertionError(
        "Could not find an implicit Post<->Tag many-to-many join table with "
        f"foreign keys to both Post and Tag. Discovered FK layout: {by_table}"
    )


def _seed_database():
    assert DATABASE_URL, "DATABASE_URL environment variable is not set; cannot seed the database."
    conn = psycopg2.connect(DATABASE_URL)
    try:
        conn.autocommit = True
        cur = conn.cursor()
        join_table, post_col, tag_col = _discover_join_table(cur)

        cur.execute(
            f'TRUNCATE TABLE "Post", "Tag", "{join_table}" RESTART IDENTITY CASCADE'
        )

        for name, tag_id in TAGS.items():
            cur.execute('INSERT INTO "Tag" ("id", "name") VALUES (%s, %s)', (tag_id, name))

        for post_id, title, created_at, _tag_names in POSTS:
            cur.execute(
                'INSERT INTO "Post" ("id", "title", "createdAt") VALUES (%s, %s, %s)',
                (post_id, title, created_at),
            )

        for post_id, _title, _created_at, tag_names in POSTS:
            for tag_name in tag_names:
                cur.execute(
                    f'INSERT INTO "{join_table}" ("{post_col}", "{tag_col}") VALUES (%s, %s)',
                    (post_id, TAGS[tag_name]),
                )
        cur.close()
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Long-running Wasp dev server fixture.
# ---------------------------------------------------------------------------
def _ensure_postgres():
    subprocess.run(
        ["pg_ctlcluster", "16", "main", "start"],
        check=False,
        capture_output=True,
        text=True,
    )
    for _ in range(60):
        ready = subprocess.run(
            ["pg_isready", "-h", "localhost", "-p", "5432"],
            capture_output=True,
            text=True,
        )
        if ready.returncode == 0:
            return
        time.sleep(1)
    raise AssertionError("PostgreSQL server did not become ready on localhost:5432.")


@pytest.fixture(scope="session")
def wasp_app(xprocess):
    # Make sure the local PostgreSQL server is up before touching the database.
    _ensure_postgres()

    # Apply the schema/migrations to the database before starting the server.
    migrate = subprocess.run(
        ["wasp", "db", "migrate-dev", "--name", "init"],
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=600,
    )
    print("=============== [wasp db migrate-dev] stdout ===============")
    print(migrate.stdout)
    print("=============== [wasp db migrate-dev] stderr ===============")
    print(migrate.stderr)
    assert migrate.returncode == 0, f"`wasp db migrate-dev` failed: {migrate.stderr}"

    class Starter(ProcessStarter):
        name = "wasp_app"
        args = ["wasp", "start"]
        env = {**os.environ, "WASP_TELEMETRY_DISABLE": "1", "BROWSER": "none"}
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 900
        terminate_on_interrupt = True
        max_read_lines = 500000

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(2)
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            # The server port is open; confirm the operations route is mounted
            # by issuing a well-formed request and accepting any HTTP response.
            try:
                resp = requests.post(
                    OPERATION_URL,
                    json={"json": {"page": 1, "pageSize": 1,
                                   "sortBy": {"field": "createdAt", "direction": "asc"}}},
                    timeout=20,
                )
                return resp.status_code is not None
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
            lines = []
        new = lines[printed:]
        printed = len(lines)
        print(f"=============== [{tag}] wasp start log ===============")
        print("".join(new))
        print(f"=============== [{tag}] end wasp start log ===============")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    # Seed the database now that the schema exists and the server is running.
    _seed_database()

    yield
    capture_logs("TEARDOWN")
    info.terminate()


# ---------------------------------------------------------------------------
# Query invocation + assertion helpers.
# ---------------------------------------------------------------------------
def call_get_posts(args):
    resp = requests.post(OPERATION_URL, json={"json": args}, timeout=60)
    assert resp.status_code == 200, (
        f"getPosts call failed with status {resp.status_code} for args {args}: {resp.text}"
    )
    body = resp.json()
    if isinstance(body, dict) and "json" in body:
        data = body["json"]
    else:
        data = body
    assert isinstance(data, dict), f"Unexpected getPosts response payload: {body}"
    assert "posts" in data, f"Response missing 'posts' key: {data}"
    assert "totalCount" in data, f"Response missing 'totalCount' key: {data}"
    return data


def titles(data):
    return [p["title"] for p in data["posts"]]


def tag_names_of(data, title):
    for p in data["posts"]:
        if p["title"] == title:
            return {t["name"] for t in p["tags"]}
    raise AssertionError(f"Post titled {title!r} not found in response posts: {titles(data)}")


# ---------------------------------------------------------------------------
# Test cases (each grounded in the verification plan).
# ---------------------------------------------------------------------------
def test_no_filter_full_listing_created_at_asc(wasp_app):
    data = call_get_posts(
        {"page": 1, "pageSize": 100, "sortBy": {"field": "createdAt", "direction": "asc"}}
    )
    assert data["totalCount"] == 9, f"Expected totalCount 9, got {data['totalCount']}"
    assert titles(data) == [
        "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India",
    ], f"Unexpected ordering for full createdAt-asc listing: {titles(data)}"
    assert tag_names_of(data, "Alpha") == {"tech", "news"}, "Alpha should include tags tech and news."
    assert tag_names_of(data, "Charlie") == {"tech", "news", "sports"}, (
        "Charlie should include tags tech, news and sports."
    )


def test_and_multi_tag_filter_page_one(wasp_app):
    data = call_get_posts(
        {"tagNames": ["tech", "news"], "page": 1, "pageSize": 2,
         "sortBy": {"field": "createdAt", "direction": "asc"}}
    )
    assert data["totalCount"] == 4, f"Expected totalCount 4 for tech AND news, got {data['totalCount']}"
    assert titles(data) == ["Alpha", "Charlie"], f"Unexpected page 1 result: {titles(data)}"


def test_and_multi_tag_filter_page_two(wasp_app):
    data = call_get_posts(
        {"tagNames": ["tech", "news"], "page": 2, "pageSize": 2,
         "sortBy": {"field": "createdAt", "direction": "asc"}}
    )
    assert data["totalCount"] == 4, f"Expected totalCount 4 for tech AND news, got {data['totalCount']}"
    assert titles(data) == ["Echo", "Golf"], f"Unexpected page 2 result: {titles(data)}"


def test_pagination_boundary_beyond_results(wasp_app):
    data = call_get_posts(
        {"tagNames": ["tech", "news"], "page": 3, "pageSize": 2,
         "sortBy": {"field": "createdAt", "direction": "asc"}}
    )
    assert data["totalCount"] == 4, f"Expected totalCount 4 even past the last page, got {data['totalCount']}"
    assert titles(data) == [], f"Expected an empty page past the last page, got {titles(data)}"


def test_sort_by_title_descending(wasp_app):
    data = call_get_posts(
        {"page": 1, "pageSize": 3, "sortBy": {"field": "title", "direction": "desc"}}
    )
    assert data["totalCount"] == 9, f"Expected totalCount 9, got {data['totalCount']}"
    assert titles(data) == ["India", "Hotel", "Golf"], f"Unexpected title-desc page 1: {titles(data)}"


def test_single_tag_created_at_desc_with_tiebreaker(wasp_app):
    data = call_get_posts(
        {"tagNames": ["tech"], "page": 1, "pageSize": 3,
         "sortBy": {"field": "createdAt", "direction": "desc"}}
    )
    assert data["totalCount"] == 7, f"Expected totalCount 7 for tech, got {data['totalCount']}"
    assert titles(data) == ["Hotel", "India", "Golf"], (
        f"Expected id-ascending tiebreaker within the createdAt tie, got {titles(data)}"
    )


def test_three_tag_and_filter_narrows_to_one(wasp_app):
    data = call_get_posts(
        {"tagNames": ["tech", "news", "food"], "page": 1, "pageSize": 10,
         "sortBy": {"field": "createdAt", "direction": "asc"}}
    )
    assert data["totalCount"] == 1, f"Expected totalCount 1 for tech AND news AND food, got {data['totalCount']}"
    assert titles(data) == ["Golf"], f"Expected only Golf, got {titles(data)}"


def test_empty_tag_names_behaves_as_no_filter(wasp_app):
    data = call_get_posts(
        {"tagNames": [], "page": 1, "pageSize": 3,
         "sortBy": {"field": "createdAt", "direction": "asc"}}
    )
    assert data["totalCount"] == 9, f"Expected totalCount 9 for empty tagNames, got {data['totalCount']}"
    assert titles(data) == ["Alpha", "Bravo", "Charlie"], f"Unexpected result for empty filter: {titles(data)}"
