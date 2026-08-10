import os
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/qwik-search"
PORT = 3000
# Connect over IPv4 explicitly. On Node 17+ `localhost` may resolve to the IPv6
# loopback (::1); the dev server is started with --host 0.0.0.0 which binds all
# IPv4 interfaces, so 127.0.0.1 is reliable.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api/search"


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "qwik_search_app"
        # This mirrors the documented start command exactly:
        #   npm run dev -- --port 3000 --host 0.0.0.0
        args = ["npm", "run", "dev", "--", "--port", str(PORT), "--host", "0.0.0.0"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 300
        terminate_on_interrupt = True
        max_read_lines = 5000

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                # First request triggers Vite on-demand compilation; be patient.
                resp = requests.get(BASE_URL, timeout=60)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture_logs(tag):
        nonlocal printed
        try:
            with open(info.logpath) as f:
                lines = f.readlines()
        except OSError:
            lines = []
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new))
        print(f"===== [{tag}] end =====")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
        # Warm up the client bundle so first browser interaction is not starved.
        try:
            requests.get(BASE_URL, timeout=60)
        except requests.RequestException:
            pass
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield BASE_URL

    capture_logs("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser(start_app):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture()
def page(browser):
    context = browser.new_context()
    pg = context.new_page()
    yield pg
    context.close()


# --------------------------------------------------------------------------
# HTTP endpoint contract
# --------------------------------------------------------------------------

def test_http_happy_path_java(start_app):
    r = requests.get(API_URL, params={"q": "java"}, timeout=30)
    assert r.status_code == 200, f"Expected 200 for q=java, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("query") == "java", f"Expected query=='java', got {body.get('query')!r}"
    assert body.get("count") == 2, f"Expected count==2 for q=java, got {body.get('count')!r}"
    results = body.get("results")
    assert results == [
        {"id": 1, "name": "Java"},
        {"id": 2, "name": "JavaScript"},
    ], f"Unexpected results for q=java (Jasmine must be absent, ordered by id): {results!r}"


def test_http_substring_and_ordering_script(start_app):
    r = requests.get(API_URL, params={"q": "script"}, timeout=30)
    assert r.status_code == 200, f"Expected 200 for q=script, got {r.status_code}"
    body = r.json()
    assert body.get("count") == 2, f"Expected count==2 for q=script, got {body.get('count')!r}"
    ids = [item["id"] for item in body.get("results", [])]
    assert ids == [2, 10], f"Expected ids [2, 10] (JavaScript, TypeScript) ascending, got {ids!r}"


def test_http_broad_match_ja(start_app):
    r = requests.get(API_URL, params={"q": "ja"}, timeout=30)
    assert r.status_code == 200, f"Expected 200 for q=ja, got {r.status_code}"
    body = r.json()
    assert body.get("count") == 3, f"Expected count==3 for q=ja, got {body.get('count')!r}"
    ids = [item["id"] for item in body.get("results", [])]
    assert ids == [1, 2, 3], f"Expected ids [1, 2, 3] (Java, JavaScript, Jasmine), got {ids!r}"


def test_http_too_short_single_char(start_app):
    r = requests.get(API_URL, params={"q": "r"}, timeout=30)
    assert r.status_code == 400, f"Expected 400 for 1-char query, got {r.status_code}"
    assert r.json().get("error") == "query must be at least 2 characters", \
        f"Unexpected error body: {r.text}"


def test_http_missing_param(start_app):
    r = requests.get(API_URL, timeout=30)
    assert r.status_code == 400, f"Expected 400 for missing q, got {r.status_code}"
    assert r.json().get("error") == "query must be at least 2 characters", \
        f"Unexpected error body: {r.text}"


def test_http_too_long(start_app):
    r = requests.get(API_URL, params={"q": "a" * 51}, timeout=30)
    assert r.status_code == 400, f"Expected 400 for 51-char query, got {r.status_code}"
    assert r.json().get("error") == "query must be at most 50 characters", \
        f"Unexpected error body: {r.text}"


def test_http_rejection_boom(start_app):
    r = requests.get(API_URL, params={"q": "boom"}, timeout=30)
    assert r.status_code == 500, f"Expected 500 for q=boom, got {r.status_code}"
    assert r.json().get("error") == "internal server error", \
        f"Unexpected error body: {r.text}"


def test_http_inverted_latency(start_app):
    # Short (2-char) queries are deliberately slow (~1600 ms); longer ones are fast (~120 ms).
    t0 = time.monotonic()
    r_slow = requests.get(API_URL, params={"q": "ja"}, timeout=30)
    slow_elapsed = time.monotonic() - t0
    assert r_slow.status_code == 200, f"q=ja should be 200, got {r_slow.status_code}"

    t1 = time.monotonic()
    r_fast = requests.get(API_URL, params={"q": "script"}, timeout=30)
    fast_elapsed = time.monotonic() - t1
    assert r_fast.status_code == 200, f"q=script should be 200, got {r_fast.status_code}"

    assert slow_elapsed >= 1.2, \
        f"Expected 2-char query to take >=1.2s (target ~1.6s), took {slow_elapsed:.3f}s"
    assert fast_elapsed <= 1.0, \
        f"Expected 6-char query to be fast (<1.0s), took {fast_elapsed:.3f}s"
    assert slow_elapsed > fast_elapsed, \
        f"Short query must be slower than long query ({slow_elapsed:.3f}s vs {fast_elapsed:.3f}s)"


# --------------------------------------------------------------------------
# Browser behavior
# --------------------------------------------------------------------------

def _result_texts(page):
    items = page.locator('[data-testid="search-result-item"]')
    return [t.strip() for t in items.all_text_contents()]


def test_browser_loading_state(page):
    page.goto(BASE_URL, wait_until="load", timeout=90000)
    page.locator('[data-testid="search-input"]').fill("ja")
    # 2-char query stays pending for ~1.6s; the pending element must appear.
    page.wait_for_selector('[data-testid="search-pending"]', state="visible", timeout=15000)


def test_browser_resolved_state(page):
    page.goto(BASE_URL, wait_until="load", timeout=90000)
    page.locator('[data-testid="search-input"]').fill("ja")
    page.wait_for_selector('[data-testid="search-results"]', state="visible", timeout=20000)
    # Wait until all three expected items are rendered.
    deadline = time.time() + 15
    texts = []
    while time.time() < deadline:
        texts = _result_texts(page)
        if set(texts) == {"Java", "JavaScript", "Jasmine"}:
            break
        page.wait_for_timeout(200)
    assert set(texts) == {"Java", "JavaScript", "Jasmine"}, \
        f"Expected resolved results {{Java, JavaScript, Jasmine}} for q=ja, got {texts!r}"


def test_browser_race_condition_stale_result_aborted(page):
    page.goto(BASE_URL, wait_until="load", timeout=90000)
    box = page.locator('[data-testid="search-input"]')

    # Type "ja": after 300ms debounce, its request starts and will only respond
    # after ~1600ms. Before it responds, change the query to "java" (which
    # responds after only ~600ms). A correct (abort-based) implementation cancels
    # the stale "ja" request so its late response never clobbers "java".
    box.fill("ja")
    page.wait_for_timeout(500)  # let the debounced "ja" request start
    box.fill("java")

    # Wait long enough for BOTH the fast "java" response (~1400ms after start) and
    # the slow "ja" response (~1900ms after start) to have elapsed.
    page.wait_for_timeout(3200)

    texts = _result_texts(page)
    assert "Jasmine" not in texts, (
        "Stale 'ja' results leaked into the final view: the in-flight request was "
        f"not aborted when the query changed to 'java'. Got {texts!r}"
    )
    assert set(texts) == {"Java", "JavaScript"}, \
        f"Expected only 'java' results {{Java, JavaScript}} after settling, got {texts!r}"
    assert page.locator('[data-testid="search-error"]').count() == 0, \
        "No error state should be shown for a successful 'java' query"


def test_browser_error_state(page):
    page.goto(BASE_URL, wait_until="load", timeout=90000)
    page.locator('[data-testid="search-input"]').fill("boom")
    page.wait_for_selector('[data-testid="search-error"]', state="visible", timeout=20000)
    assert len(_result_texts(page)) == 0, \
        "No result items should be displayed when the request is rejected"


def test_browser_idle_state_short_query(page):
    page.goto(BASE_URL, wait_until="load", timeout=90000)
    page.locator('[data-testid="search-input"]').fill("a")
    # After the debounce window, a <2-char query must show neither results nor error.
    page.wait_for_timeout(1500)
    assert len(_result_texts(page)) == 0, \
        "A single-character query must not display any results"
    assert page.locator('[data-testid="search-error"]').count() == 0, \
        "A single-character query must not display an error state"
    assert page.locator('[data-testid="search-pending"]').count() == 0, \
        "A single-character query must not remain in a pending state"
