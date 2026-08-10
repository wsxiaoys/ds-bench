import os
import re
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/blog-cms"
DB_PATH = os.path.join(PROJECT_DIR, "data", "blog.db")
PORT = 3000
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the dev server may listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects -> readiness check would hang.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


def http_get(path, timeout=30, retries=5):
    """GET a path with a few retries (the SSR dev server bundles routes on first hit)."""
    url = BASE_URL + path
    last_exc = None
    for _ in range(retries):
        try:
            return requests.get(url, timeout=timeout, allow_redirects=True)
        except requests.RequestException as exc:  # pragma: no cover - transient
            last_exc = exc
            time.sleep(2)
    raise AssertionError(f"GET {url} failed after retries: {last_exc}")


def sqlite_query(sql):
    """Run a query against the SQLite DB file using the sqlite3 CLI."""
    result = subprocess.run(
        ["sqlite3", DB_PATH, sql],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"sqlite3 query failed ({sql!r}): {result.stderr}"
    )
    return result.stdout.strip()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Start the Qwik City SSR dev server on port 3000 with a clean database."""
    # Ensure a clean database so verification starts from an empty posts table.
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "dev", "--", "--port", str(PORT), "--host", HOST]
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
                resp = requests.get(BASE_URL + "/", timeout=30)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except FileNotFoundError:
            return
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


def test_01_empty_public_listing(start_app):
    """With no published posts, the home page must not link to any post detail page."""
    resp = http_get("/")
    assert resp.status_code == 200, f"GET / expected 200, got {resp.status_code}"
    assert 'href="/posts/' not in resp.text, (
        "Home page should list no post detail links when the database is empty."
    )


def test_02_create_published_post(start_app, browser_verifier):
    """Create a published post via the admin routeAction$ form, then verify it is public."""
    reason = (
        "The admin create form uses a Qwik City routeAction$ (with zod$ validation) to "
        "persist a new published post to the local SQLite database."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/new/. Fill the field named 'title' with 'Hello Qwik', "
        f"the field named 'slug' with 'hello-qwik', and the field named 'content' with "
        f"'Resumability is great.'. Check the checkbox named 'published'. Submit the form. "
        f"The submission must be accepted with no validation error shown. Then navigate to "
        f"{BASE_URL}/admin/ and verify the page lists a post titled 'Hello Qwik'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_02_create_published_post",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    # Deterministic outcome checks.
    home = http_get("/")
    assert home.status_code == 200, f"GET / expected 200, got {home.status_code}"
    assert "Hello Qwik" in home.text, "Published post title 'Hello Qwik' missing from home page."
    assert 'href="/posts/hello-qwik/"' in home.text or 'href="/posts/hello-qwik"' in home.text, (
        "Home page must link to /posts/hello-qwik/ for the published post."
    )

    detail = http_get("/posts/hello-qwik/")
    assert detail.status_code == 200, f"GET /posts/hello-qwik/ expected 200, got {detail.status_code}"
    assert "Hello Qwik" in detail.text, "Detail page missing the post title."
    assert "Resumability is great." in detail.text, "Detail page missing the post content."

    count = sqlite_query("SELECT COUNT(*) FROM posts WHERE slug='hello-qwik';")
    assert count == "1", f"Expected exactly 1 row for slug 'hello-qwik', got {count!r}."


def test_03_unknown_slug_returns_404(start_app):
    resp = http_get("/posts/does-not-exist/")
    assert resp.status_code == 404, (
        f"GET /posts/does-not-exist/ expected 404, got {resp.status_code}"
    )


def test_04_create_draft_and_visibility(start_app, browser_verifier):
    """A draft (unpublished) post appears in admin and its detail page but NOT on the public home."""
    reason = (
        "Unpublished posts are drafts: they must be listed in the admin area and accessible by "
        "slug, but must be excluded from the public published-only home listing."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/new/. Fill the field named 'title' with 'Draft Post', "
        f"the field named 'slug' with 'draft-post', and the field named 'content' with "
        f"'Not ready yet.'. Leave the checkbox named 'published' UNCHECKED. Submit the form. "
        f"The submission must be accepted with no validation error. Then navigate to "
        f"{BASE_URL}/admin/ and verify the page lists both 'Hello Qwik' and 'Draft Post'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_04_create_draft",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    admin = http_get("/admin/")
    assert admin.status_code == 200, f"GET /admin/ expected 200, got {admin.status_code}"
    assert "Hello Qwik" in admin.text, "Admin listing must contain 'Hello Qwik'."
    assert "Draft Post" in admin.text, "Admin listing must contain the draft 'Draft Post'."

    home = http_get("/")
    assert "Draft Post" not in home.text, "Draft post must NOT appear on the public home page."

    detail = http_get("/posts/draft-post/")
    assert detail.status_code == 200, (
        f"GET /posts/draft-post/ expected 200 (draft exists), got {detail.status_code}"
    )
    assert "Not ready yet." in detail.text, "Draft detail page missing its content."


def test_05_validation_rejects_bad_slug(start_app, browser_verifier):
    """An invalid slug must be rejected by zod validation and must not create a row."""
    reason = (
        "The routeAction$ validates the slug with zod against a kebab-case pattern; an invalid "
        "slug must be rejected server-side, showing an error and writing nothing to the database."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/new/. Fill the field named 'title' with 'Bad Slug', "
        f"the field named 'slug' with 'Bad Slug!' (contains uppercase letters and a space, which "
        f"is invalid), and the field named 'content' with 'x'. Submit the form. The form must be "
        f"rejected: a validation error message must be shown and the page must NOT report success."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_05_validation_bad_slug",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    count = sqlite_query("SELECT COUNT(*) FROM posts WHERE title='Bad Slug';")
    assert count == "0", f"Invalid submission must not create a row, but found {count!r} rows."
    admin = http_get("/admin/")
    assert "Bad Slug" not in admin.text, "Rejected post 'Bad Slug' must not appear in admin listing."


def test_06_duplicate_slug_rejected(start_app, browser_verifier):
    """Creating a post with an already-used slug must fail without creating a duplicate row."""
    reason = (
        "Slug uniqueness is enforced: attempting to create a post with an existing slug must "
        "fail and must not insert a duplicate row."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/new/. Fill the field named 'title' with 'Duplicate', "
        f"the field named 'slug' with 'hello-qwik' (already used by an existing post), and the "
        f"field named 'content' with 'dupe'. Submit the form. The submission must fail (an error "
        f"must be shown) and must not create a second post."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_06_duplicate_slug",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    count = sqlite_query("SELECT COUNT(*) FROM posts WHERE slug='hello-qwik';")
    assert count == "1", f"Duplicate slug must not create a second row; found {count!r} rows for 'hello-qwik'."


def test_07_edit_post(start_app, browser_verifier):
    """Editing a post via routeAction$ must update the persisted post."""
    reason = (
        "The edit form uses a routeAction$ to update an existing post identified by its slug."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/hello-qwik/edit/. Change the field named 'title' to "
        f"'Hello Qwik Edited'. Keep the checkbox named 'published' checked. Submit the form. "
        f"The submission must be accepted with no validation error."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_07_edit_post",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    detail = http_get("/posts/hello-qwik/")
    assert detail.status_code == 200, f"GET /posts/hello-qwik/ expected 200, got {detail.status_code}"
    assert "Hello Qwik Edited" in detail.text, "Edited title 'Hello Qwik Edited' not shown on detail page."


def test_08_delete_post(start_app, browser_verifier):
    """Deleting a post via routeAction$ must remove it from the site and the database."""
    reason = "The admin delete control uses a routeAction$ to remove a post by slug."
    truth = (
        f"Navigate to {BASE_URL}/admin/. Locate the post titled 'Draft Post' (slug 'draft-post') "
        f"and use its delete control to delete it. Confirm the delete if prompted. After deletion, "
        f"the admin listing must no longer contain 'Draft Post'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_08_delete_post",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    detail = http_get("/posts/draft-post/")
    assert detail.status_code == 404, (
        f"GET /posts/draft-post/ after deletion expected 404, got {detail.status_code}"
    )
    admin = http_get("/admin/")
    assert "Draft Post" not in admin.text, "Deleted post 'Draft Post' still present in admin listing."
    count = sqlite_query("SELECT COUNT(*) FROM posts WHERE slug='draft-post';")
    assert count == "0", f"Deleted post row must be gone; found {count!r} rows for 'draft-post'."


def test_09_db_schema_and_persistence(start_app):
    """The SQLite file must have the required schema and hold the edited, published post."""
    columns_raw = sqlite_query("PRAGMA table_info(posts);")
    # Each row: cid|name|type|notnull|dflt_value|pk  -> column name is field index 1.
    column_names = {line.split("|")[1] for line in columns_raw.splitlines() if line.strip()}
    for expected in ["id", "slug", "title", "content", "published", "created_at"]:
        assert expected in column_names, (
            f"Column '{expected}' missing from posts table; found {sorted(column_names)}."
        )

    row = sqlite_query("SELECT title, published FROM posts WHERE slug='hello-qwik';")
    assert row == "Hello Qwik Edited|1", (
        f"Expected 'Hello Qwik Edited|1' for slug 'hello-qwik', got {row!r}."
    )

    created_at = sqlite_query("SELECT created_at FROM posts WHERE slug='hello-qwik';")
    assert created_at, "created_at for 'hello-qwik' must be a non-empty timestamp."
    assert re.search(r"\d{4}-\d{2}-\d{2}", created_at), (
        f"created_at should be an ISO-8601 timestamp, got {created_at!r}."
    )


def test_10_server_db_layer_not_in_client_bundle(start_app):
    """Production build must succeed and the client bundle must not leak DB code/SQL."""
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert build.returncode == 0, (
        f"'npm run build' failed (exit {build.returncode}).\nSTDOUT:\n{build.stdout}\nSTDERR:\n{build.stderr}"
    )

    dist_dir = os.path.join(PROJECT_DIR, "dist")
    assert os.path.isdir(dist_dir), f"Client build output directory {dist_dir} was not created."

    forbidden = ["better-sqlite3", "@prisma/client", "blog.db", "create table"]
    offenders = []
    for root, _dirs, files in os.walk(dist_dir):
        for fname in files:
            if not fname.endswith(".js"):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read().lower()
            except OSError:
                continue
            for needle in forbidden:
                if needle in content:
                    offenders.append((fpath, needle))

    assert not offenders, (
        "Server-only database code leaked into the client bundle: "
        + ", ".join(f"{path} contains {needle!r}" for path, needle in offenders)
    )
