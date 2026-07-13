import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
BASE_URL = f"http://127.0.0.1:{PORT}"

# Deterministic seed data (see the `truth` verification plan).
POST_1 = {
    "id": "p1",
    "slug": "edge-rendering-intro",
    "title": "Getting Started at the Edge",
    "content": "Edge rendering keeps latency low by running close to users.",
}
POST_2 = {
    "id": "p2",
    "slug": "d1-drizzle-basics",
    "title": "D1 and Drizzle Basics",
    "content": "D1 brings SQLite to Cloudflare and Drizzle gives it type-safe queries.",
}


def _run(args, timeout=300):
    """Run a subprocess in the project directory and return the CompletedProcess."""
    return subprocess.run(
        args,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=os.environ.copy(),
    )


def _seed_database():
    """Apply migrations and seed deterministic posts into the local D1 database."""
    # Ensure dependencies are present (idempotent if already installed).
    install = _run(["npm", "install"], timeout=600)
    print("=== npm install ===")
    print(install.stdout)
    print(install.stderr)

    # Apply the agent's generated migrations to the local D1 database.
    migrate = _run(["npx", "wrangler", "d1", "migrations", "apply", "DB", "--local"])
    print("=== wrangler d1 migrations apply ===")
    print(migrate.stdout)
    print(migrate.stderr)

    # Clean any previous rows for idempotency (ignore failures if table is empty).
    _run(
        [
            "npx",
            "wrangler",
            "d1",
            "execute",
            "DB",
            "--local",
            "--command",
            "DELETE FROM posts WHERE id IN ('p1','p2');",
        ]
    )

    values = (
        f"('{POST_1['id']}','{POST_1['slug']}','{POST_1['title']}','{POST_1['content']}'),"
        f"('{POST_2['id']}','{POST_2['slug']}','{POST_2['title']}','{POST_2['content']}')"
    )
    insert_sql = f"INSERT INTO posts (id, slug, title, content) VALUES {values};"
    insert = _run(
        [
            "npx",
            "wrangler",
            "d1",
            "execute",
            "DB",
            "--local",
            "--command",
            insert_sql,
        ]
    )
    print("=== wrangler d1 execute (seed) ===")
    print(insert.stdout)
    print(insert.stderr)
    assert insert.returncode == 0, (
        "Failed to seed the 'posts' table via wrangler d1 execute. The task requires a D1 "
        "database bound as 'DB' with a 'posts' table containing columns (id, slug, title, "
        f"content). stdout: {insert.stdout} stderr: {insert.stderr}"
    )


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Seed the database, then start the RedwoodSDK dev server on port 5173."""
    _seed_database()

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
                return s.connect_ex(("127.0.0.1", PORT)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"========== [{tag}: Begin] {Starter.name} logfile ==========")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"========== [{tag}: End] {Starter.name} logfile ==========")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _get(path, expected_status=None, retries=30, delay=2):
    """GET a path, retrying to allow the Vite dev server to compile on first hit."""
    last_exc = None
    last_resp = None
    for _ in range(retries):
        try:
            resp = requests.get(f"{BASE_URL}{path}", timeout=30)
            last_resp = resp
            # The first request to a route may 500 while the dev server compiles.
            if expected_status is None or resp.status_code == expected_status:
                return resp
            if resp.status_code < 500:
                return resp
        except requests.RequestException as exc:
            last_exc = exc
        time.sleep(delay)
    if last_resp is not None:
        return last_resp
    raise AssertionError(f"Could not reach {BASE_URL}{path}: {last_exc}")


def test_blog_index_lists_posts(start_app):
    resp = _get("/blog", expected_status=200)
    assert resp.status_code == 200, (
        f"GET /blog should return 200, got {resp.status_code}. Body: {resp.text[:500]}"
    )
    body = resp.text
    assert POST_1["title"] in body, (
        f"Expected post title '{POST_1['title']}' to appear on /blog index page."
    )
    assert POST_2["title"] in body, (
        f"Expected post title '{POST_2['title']}' to appear on /blog index page."
    )
    assert f'/blog/{POST_1["slug"]}' in body, (
        f"Expected a link to /blog/{POST_1['slug']} on the /blog index page."
    )
    assert f'/blog/{POST_2["slug"]}' in body, (
        f"Expected a link to /blog/{POST_2['slug']} on the /blog index page."
    )


def test_blog_slug_renders_full_post_one(start_app):
    resp = _get(f"/blog/{POST_1['slug']}", expected_status=200)
    assert resp.status_code == 200, (
        f"GET /blog/{POST_1['slug']} should return 200, got {resp.status_code}."
    )
    body = resp.text
    assert POST_1["title"] in body, (
        f"Expected title '{POST_1['title']}' on /blog/{POST_1['slug']}."
    )
    assert POST_1["content"] in body, (
        f"Expected full content of post '{POST_1['slug']}' to be rendered."
    )


def test_blog_slug_renders_full_post_two(start_app):
    resp = _get(f"/blog/{POST_2['slug']}", expected_status=200)
    assert resp.status_code == 200, (
        f"GET /blog/{POST_2['slug']} should return 200, got {resp.status_code}."
    )
    body = resp.text
    assert POST_2["title"] in body, (
        f"Expected title '{POST_2['title']}' on /blog/{POST_2['slug']}."
    )
    assert POST_2["content"] in body, (
        f"Expected full content of post '{POST_2['slug']}' to be rendered."
    )


def test_unknown_slug_returns_404(start_app):
    resp = _get("/blog/this-slug-does-not-exist", expected_status=404)
    assert resp.status_code == 404, (
        "GET /blog/this-slug-does-not-exist should return HTTP 404, got "
        f"{resp.status_code}."
    )
