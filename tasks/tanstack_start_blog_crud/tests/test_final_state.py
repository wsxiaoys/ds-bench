import os
import signal
import socket
import subprocess
import time

import pytest
import requests
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/blog"
PORT = 43117
# Connect over IPv4 explicitly. On Node 17+ `localhost` may resolve to the IPv6
# loopback (::1) while the server listens on IPv4, causing confusing hangs.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

SERVER_LOG = "/logs/verifier/blog_server.log"


def _wait_ready(timeout: int = 120) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = requests.get(BASE_URL + "/", timeout=10)
            if resp.status_code < 500:
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    return False


def _wait_down(timeout: int = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((HOST, PORT)) != 0:
                return True
        time.sleep(1)
    return False


class ServerManager:
    """Manages the production TanStack Start server so tests can restart it."""

    def __init__(self):
        self.proc = None
        self._log = None
        os.makedirs(os.path.dirname(SERVER_LOG), exist_ok=True)

    def start(self):
        env = os.environ.copy()
        env["PORT"] = str(PORT)
        env["HOST"] = "0.0.0.0"
        env["NODE_ENV"] = "production"
        log = open(SERVER_LOG, "a")
        log.write(f"\n===== starting server @ {time.ctime()} =====\n")
        log.flush()
        self.proc = subprocess.Popen(
            ["npm", "run", "start"],
            cwd=PROJECT_DIR,
            env=env,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        self._log = log
        ready = _wait_ready()
        if not ready:
            self.dump_logs("START-FAILED")
        assert ready, (
            f"Server did not become ready on {BASE_URL} within timeout. See {SERVER_LOG}."
        )

    def stop(self):
        if self.proc is not None:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                self.proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                except ProcessLookupError:
                    pass
            self.proc = None
            _wait_down()
        log = self._log
        if log is not None:
            try:
                log.close()
            except Exception:
                pass
            self._log = None

    def restart(self):
        self.stop()
        time.sleep(2)
        self.start()

    def dump_logs(self, tag: str):
        try:
            with open(SERVER_LOG) as f:
                content = f.read()
        except OSError:
            content = "(no log)"
        print(f"===== [{tag}] server log begin =====")
        print(content[-8000:])
        print(f"===== [{tag}] server log end =====")


@pytest.fixture(scope="session")
def server():
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1200,
    )
    assert build.returncode == 0, (
        f"`npm run build` failed.\nSTDOUT:\n{build.stdout}\nSTDERR:\n{build.stderr}"
    )
    mgr = ServerManager()
    mgr.start()
    yield mgr
    mgr.dump_logs("TEARDOWN")
    mgr.stop()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


def test_create_published_post_and_render_markdown(server, browser_verifier):
    reason = (
        "The blog CMS must let an author create a published post through the admin "
        "create form, then show it on the public list as a link, and render the "
        "Markdown body to HTML on the public detail page (server-side rendered)."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/new . Fill the title field with exactly "
        "'Frontier Alpha Post'. In the body textarea enter this Markdown on two "
        "separate lines -- line 1: '## Section One' and line 2: "
        "'This is **bold alpha** text.'. Fill the tags field with 'react, ssr'. "
        "Make sure the Published checkbox is checked. Submit the form to save the post. "
        f"Then navigate to {BASE_URL}/ and confirm there is a link (an <a> element) "
        "whose visible text is 'Frontier Alpha Post' and whose href is exactly "
        f"'/posts/frontier-alpha-post'. Then navigate to {BASE_URL}/posts/frontier-alpha-post "
        "and confirm: (a) there is an <h1> element whose text is 'Frontier Alpha Post'; "
        "(b) inside the element that has attribute data-testid=\"post-body\" there is a "
        "<strong> element whose text is 'bold alpha' and an <h2> element whose text is "
        "'Section One'. The verification passes only if all of these are true."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_create_published_post_and_render_markdown",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_detail_page_is_server_side_rendered(server):
    resp = requests.get(BASE_URL + "/posts/frontier-alpha-post", timeout=30)
    assert resp.status_code == 200, (
        f"Expected 200 for published post detail, got {resp.status_code}."
    )
    html = resp.text
    assert "Frontier Alpha Post" in html, (
        "Post title not present in server-rendered HTML (SSR requirement)."
    )
    assert "Section One" in html, (
        "Rendered Markdown heading text 'Section One' not present in server-rendered HTML."
    )
    assert "bold alpha" in html, (
        "Rendered Markdown body text 'bold alpha' not present in server-rendered HTML."
    )


def test_slug_uniqueness_for_duplicate_title(server, browser_verifier):
    reason = (
        "Slugs are auto-generated from the title and must be unique. Creating a second "
        "post with a title that produces an already-used slug must get a distinct slug "
        "with a numeric suffix."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/new . Fill the title field with exactly "
        "'Frontier Alpha Post' (the same title as an existing post). Fill the body "
        "textarea with 'hello two'. Leave the tags field empty. Ensure the Published "
        "checkbox is checked. Submit the form. Then navigate to "
        f"{BASE_URL}/posts/frontier-alpha-post-2 and confirm the page loads a post whose "
        "<h1> element text is 'Frontier Alpha Post'. The verification passes only if that "
        "detail page exists and shows that title."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_slug_uniqueness_for_duplicate_title",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_public_list_tag_filtering(server, browser_verifier):
    reason = (
        "The public post list must be filterable by tag through the URL query parameter "
        "`tag`, showing only published posts that have that exact tag."
    )
    truth = (
        f"First create two published posts via {BASE_URL}/admin/new . "
        "Post 1: title 'Beta Guide', body '**beta**', tags 'guide', Published checked, submit. "
        "Post 2: title 'Gamma Guide', body 'gamma body', tags 'react', Published checked, submit. "
        f"Then navigate to {BASE_URL}/?tag=guide and confirm the list shows 'Beta Guide' but "
        "does NOT show 'Gamma Guide' and does NOT show 'Frontier Alpha Post'. "
        f"Then navigate to {BASE_URL}/?tag=react and confirm the list shows both "
        "'Frontier Alpha Post' and 'Gamma Guide' but does NOT show 'Beta Guide'. "
        "The verification passes only if both filtered views are exactly correct."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_public_list_tag_filtering",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_edit_persists_after_reload(server, browser_verifier):
    reason = (
        "Editing a post must persist the change; after reloading the public detail page "
        "the updated, re-rendered Markdown body must be shown."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/beta-guide/edit . Change the body textarea content "
        "to exactly '**beta updated**' (replacing the previous body). Submit the form to "
        f"save. Then navigate to {BASE_URL}/posts/beta-guide and reload the page. Confirm "
        "that inside the element with attribute data-testid=\"post-body\" there is a "
        "<strong> element whose text is 'beta updated'. The verification passes only if the "
        "updated bold text is present after reload."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_edit_persists_after_reload",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_draft_hidden_from_public_visible_in_admin(server, browser_verifier):
    reason = (
        "Marking a post as draft must remove it from every public page while keeping it "
        "visible in the admin list."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin/gamma-guide/edit . Uncheck the Published checkbox so "
        "the post becomes a draft. Submit the form to save. Then navigate to "
        f"{BASE_URL}/ and confirm 'Gamma Guide' is NOT shown anywhere in the public list. "
        f"Then navigate to {BASE_URL}/admin and confirm 'Gamma Guide' IS listed there. "
        "The verification passes only if the draft is hidden publicly but visible in admin."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_draft_hidden_from_public_visible_in_admin",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_draft_and_unknown_slug_return_404(server):
    # Draft post must not be publicly reachable.
    draft_resp = requests.get(BASE_URL + "/posts/gamma-guide", timeout=30)
    assert draft_resp.status_code == 404, (
        f"Expected 404 for a draft post's public detail page, got {draft_resp.status_code}."
    )
    assert "not found" in draft_resp.text.lower(), (
        "Expected the draft post's not-found page text to contain 'Not Found'."
    )

    # Draft content must be absent from the public list's raw HTML.
    list_html = requests.get(BASE_URL + "/", timeout=30).text
    assert "Gamma Guide" not in list_html, (
        "Draft post 'Gamma Guide' must not appear in the server-rendered public list HTML."
    )

    # Unknown slug must 404.
    unknown_resp = requests.get(
        BASE_URL + "/posts/this-slug-does-not-exist-zzz", timeout=30
    )
    assert unknown_resp.status_code == 404, (
        f"Expected 404 for an unknown slug, got {unknown_resp.status_code}."
    )
    assert "not found" in unknown_resp.text.lower(), (
        "Expected the unknown-slug not-found page text to contain 'Not Found'."
    )


def test_delete_removes_post(server, browser_verifier):
    reason = (
        "Deleting a post from the admin list must permanently remove it from both the "
        "admin and public views."
    )
    truth = (
        f"Navigate to {BASE_URL}/admin . Click the delete control for the post whose slug "
        "is 'frontier-alpha-post-2' -- it is a <button> element with attribute "
        "data-testid=\"delete-frontier-alpha-post-2\". After clicking, confirm the deletion "
        "is processed (the post 'Frontier Alpha Post' associated with slug "
        "'frontier-alpha-post-2' is removed). The verification passes once that delete "
        "button has been clicked and the post is no longer listed under that slug."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_delete_removes_post",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    deleted_resp = requests.get(BASE_URL + "/posts/frontier-alpha-post-2", timeout=30)
    assert deleted_resp.status_code == 404, (
        f"Expected 404 for the deleted post, got {deleted_resp.status_code}."
    )
    kept_resp = requests.get(BASE_URL + "/posts/frontier-alpha-post", timeout=30)
    assert kept_resp.status_code == 200, (
        f"The non-deleted original post should still return 200, got {kept_resp.status_code}."
    )


def test_data_persists_across_restart(server):
    server.restart()
    resp = requests.get(BASE_URL + "/posts/frontier-alpha-post", timeout=30)
    assert resp.status_code == 200, (
        f"After restart, published post should still return 200, got {resp.status_code}."
    )
    assert "Frontier Alpha Post" in resp.text, (
        "After restart, the persisted post title must still be present (SQLite persistence)."
    )
