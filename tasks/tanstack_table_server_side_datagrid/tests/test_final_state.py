import math
import os
import re
import socket
import time
from urllib.parse import unquote

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 34517
# Connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the IPv6
# loopback (::1); using 127.0.0.1 keeps the readiness check and the app on the
# same address.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
API_URL = f"{BASE_URL}/api/employees"

# ---------------------------------------------------------------------------
# Seed-derived facts (see task truth). Default sort id:asc, default pageSize 8.
# ---------------------------------------------------------------------------
PAGE1_NAMES = [
    "Alice Johnson",
    "Bob Smith",
    "Carol Nguyen",
    "David Lee",
    "Emma Brown",
    "Frank Wilson",
    "Grace Kim",
    "Henry Davis",
]
PAGE1_IDS = [1, 2, 3, 4, 5, 6, 7, 8]
PAGE2_IDS = [9, 10, 11, 12, 13, 14, 15, 16]
NGUYEN_NAMES = ["Carol Nguyen", "Jack Nguyen", "Paul Nguyen"]


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "run", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 300
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(API_URL, timeout=20)
                return resp.status_code in (200, 400)
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed = 0

    def capture(tag):
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
        capture("STARTED" if started else "FAILED")

    # Extra warm-up: make sure SSR HTML route responds too.
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            r = requests.get(BASE_URL, timeout=10)
            if r.status_code < 500:
                break
        except requests.RequestException:
            pass
        time.sleep(1)

    yield
    capture("TEARDOWN")
    info.terminate()


def _get(params=None):
    return requests.get(API_URL, params=params, timeout=20)


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------
def test_api_defaults(start_app):
    r = _get()
    assert r.status_code == 200, f"GET /api/employees should be 200, got {r.status_code}: {r.text[:300]}"
    d = r.json()
    assert d.get("total") == 24, f"Expected total=24, got {d.get('total')!r}"
    assert d.get("page") == 1, f"Expected default page=1, got {d.get('page')!r}"
    assert d.get("pageSize") == 8, f"Expected default pageSize=8, got {d.get('pageSize')!r}"
    assert d.get("pageCount") == 3, f"Expected pageCount=3, got {d.get('pageCount')!r}"
    rows = d.get("rows")
    assert isinstance(rows, list) and len(rows) == 8, f"Expected 8 rows on page 1, got {rows!r}"
    assert [row.get("id") for row in rows] == PAGE1_IDS, (
        f"Default page 1 ids must be {PAGE1_IDS}, got {[row.get('id') for row in rows]!r}"
    )


def test_api_global_filter(start_app):
    r = _get({"q": "nguyen", "pageSize": "20"})
    assert r.status_code == 200, f"GET ?q=nguyen should be 200, got {r.status_code}: {r.text[:300]}"
    d = r.json()
    assert d.get("total") == 3, f"Expected total=3 for q=nguyen, got {d.get('total')!r}"
    names = {row.get("name") for row in d.get("rows", [])}
    assert names == set(NGUYEN_NAMES), f"Expected names {set(NGUYEN_NAMES)}, got {names!r}"


def test_api_global_filter_case_insensitive(start_app):
    r = _get({"q": "NGUYEN", "pageSize": "20"})
    assert r.status_code == 200, f"GET ?q=NGUYEN should be 200, got {r.status_code}: {r.text[:300]}"
    names = {row.get("name") for row in r.json().get("rows", [])}
    assert names == set(NGUYEN_NAMES), (
        f"Filter must be case-insensitive; expected {set(NGUYEN_NAMES)}, got {names!r}"
    )


def test_api_single_column_sort_desc(start_app):
    r = _get({"sort": "salary:desc", "pageSize": "24"})
    assert r.status_code == 200, f"GET ?sort=salary:desc should be 200, got {r.status_code}: {r.text[:300]}"
    rows = r.json().get("rows", [])
    assert len(rows) == 24, f"Expected all 24 rows, got {len(rows)}"
    salaries = [row.get("salary") for row in rows]
    for i in range(1, len(salaries)):
        assert salaries[i - 1] >= salaries[i], f"Salaries must be non-increasing, got {salaries!r}"
    assert rows[0].get("name") == "Sam Jackson", f"Top salary must be Sam Jackson, got {rows[0]!r}"
    assert rows[-1].get("name") == "David Lee", f"Lowest salary must be David Lee, got {rows[-1]!r}"


def test_api_multi_column_sort(start_app):
    r = _get({"sort": "department:asc,salary:desc", "pageSize": "24"})
    assert r.status_code == 200, (
        f"GET ?sort=department:asc,salary:desc should be 200, got {r.status_code}: {r.text[:300]}"
    )
    rows = r.json().get("rows", [])
    assert len(rows) == 24, f"Expected all 24 rows, got {len(rows)}"
    depts = [row.get("department") for row in rows]
    for i in range(1, len(depts)):
        assert depts[i - 1] <= depts[i], f"Departments must be non-decreasing (asc), got {depts!r}"
    # within each department, salary must be non-increasing
    for i in range(1, len(rows)):
        if rows[i].get("department") == rows[i - 1].get("department"):
            assert rows[i - 1].get("salary") >= rows[i].get("salary"), (
                f"Within a department salary must be non-increasing, violated at index {i}: {rows[i-1]!r} then {rows[i]!r}"
            )
    assert rows[0].get("id") == 17, f"First row of department:asc,salary:desc must be id 17 (Quinn Taylor), got {rows[0]!r}"


def test_api_pagination(start_app):
    r = _get({"page": "2", "pageSize": "8"})
    assert r.status_code == 200, f"GET ?page=2&pageSize=8 should be 200, got {r.status_code}: {r.text[:300]}"
    d = r.json()
    assert d.get("page") == 2, f"Expected page=2, got {d.get('page')!r}"
    assert d.get("pageSize") == 8, f"Expected pageSize=8, got {d.get('pageSize')!r}"
    assert d.get("total") == 24, f"Expected total=24, got {d.get('total')!r}"
    ids = [row.get("id") for row in d.get("rows", [])]
    assert ids == PAGE2_IDS, f"Page 2 (id asc) must be ids {PAGE2_IDS}, got {ids!r}"


@pytest.mark.parametrize(
    "params",
    [
        {"page": "0"},
        {"page": "abc"},
        {"pageSize": "0"},
        {"pageSize": "500"},
        {"sort": "bogus:asc"},
        {"sort": "salary:sideways"},
    ],
)
def test_api_invalid_params_return_400(start_app, params):
    r = _get(params)
    assert r.status_code == 400, (
        f"GET /api/employees with invalid {params!r} must return 400, got {r.status_code}: {r.text[:300]}"
    )
    body = r.json()
    assert isinstance(body, dict), f"400 body must be a JSON object, got {type(body).__name__}"
    err = body.get("error")
    assert isinstance(err, str) and err, f"400 body must contain a non-empty 'error' string, got {body!r}"


# ---------------------------------------------------------------------------
# SSR (server-side paging) tests
# ---------------------------------------------------------------------------
def test_ssr_page1_content(start_app):
    r = requests.get(BASE_URL, timeout=20)
    assert r.status_code == 200, f"GET / should be 200, got {r.status_code}"
    assert "text/html" in r.headers.get("Content-Type", "").lower(), "GET / should return HTML"
    body = r.text
    assert "Alice Johnson" in body, "SSR HTML of page 1 must contain 'Alice Johnson'"
    assert "Grace Kim" in body, "SSR HTML of page 1 must contain 'Grace Kim'"
    assert "Ivy Martinez" not in body, "SSR HTML of page 1 must NOT contain page-2 row 'Ivy Martinez'"


def test_ssr_page2_content(start_app):
    r = requests.get(f"{BASE_URL}/?page=2", timeout=20)
    assert r.status_code == 200, f"GET /?page=2 should be 200, got {r.status_code}"
    body = r.text
    assert "Ivy Martinez" in body, "SSR HTML of page 2 must contain 'Ivy Martinez'"
    assert "Paul Nguyen" in body, "SSR HTML of page 2 must contain 'Paul Nguyen'"
    assert "Alice Johnson" not in body, "SSR HTML of page 2 must NOT contain page-1 row 'Alice Johnson'"


def test_ssr_invalid_page_does_not_crash(start_app):
    r = requests.get(f"{BASE_URL}/?page=abc", timeout=20)
    assert r.status_code == 200, f"GET /?page=abc must return 200 (defaults applied), got {r.status_code}"


# ---------------------------------------------------------------------------
# Browser (Playwright) tests: URL sync, reload restoration, history back/forward
# ---------------------------------------------------------------------------
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
    pg.set_default_timeout(20000)
    yield pg
    context.close()


def _names(pg):
    return [t.strip() for t in pg.locator('[data-testid="cell-name"]').all_inner_texts()]


def _total(pg):
    txt = pg.locator('[data-testid="total-count"]').first.inner_text()
    m = re.search(r"\d+", txt)
    return int(m.group()) if m else None


def _url(pg):
    return unquote(pg.url)


def _wait_until(pg, predicate, desc, timeout=20):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        try:
            if predicate(pg):
                return
            last = "predicate false"
        except Exception as e:  # noqa: BLE001
            last = repr(e)
        time.sleep(0.3)
    raise AssertionError(f"Timed out waiting for: {desc} (last={last}); url={pg.url}; names={_names(pg)}")


def test_browser_default_render(page):
    page.goto(BASE_URL)
    page.wait_for_selector('[data-testid="cell-name"]')
    _wait_until(page, lambda pg: _names(pg) == PAGE1_NAMES, f"default rows == {PAGE1_NAMES}")
    assert _total(page) == 24, f"total-count should read 24 on default view, got {_total(page)}"


def test_browser_interactive_flow(page):
    # 1. Default view.
    page.goto(BASE_URL)
    page.wait_for_selector('[data-testid="cell-name"]')
    _wait_until(page, lambda pg: _names(pg) == PAGE1_NAMES, "default page-1 rows")

    # 2. Click-to-sort by salary ascending -> first row David Lee, URL sort=salary:asc.
    page.click('[data-testid="sort-salary"]')
    _wait_until(page, lambda pg: _names(pg)[:1] == ["David Lee"], "salary asc top row = David Lee")
    _wait_until(page, lambda pg: "salary:asc" in _url(pg), "URL contains sort=salary:asc")

    # 3. Toggle to descending -> first row Sam Jackson, URL sort=salary:desc.
    page.click('[data-testid="sort-salary"]')
    _wait_until(page, lambda pg: _names(pg)[:1] == ["Sam Jackson"], "salary desc top row = Sam Jackson")
    _wait_until(page, lambda pg: "salary:desc" in _url(pg), "URL contains sort=salary:desc")

    # 4. Next page (salary desc) -> first row Ivy Martinez, URL page=2.
    page.click('[data-testid="next-page"]')
    _wait_until(page, lambda pg: _names(pg)[:1] == ["Ivy Martinez"], "salary desc page 2 top row = Ivy Martinez")
    _wait_until(page, lambda pg: "page=2" in _url(pg), "URL contains page=2")

    # 5. Reload -> state restored from URL.
    page.reload()
    page.wait_for_selector('[data-testid="cell-name"]')
    _wait_until(page, lambda pg: _names(pg)[:1] == ["Ivy Martinez"], "after reload, page 2 top row = Ivy Martinez")
    assert "salary:desc" in _url(page), f"after reload URL must keep sort=salary:desc, got {page.url}"
    assert "page=2" in _url(page), f"after reload URL must keep page=2, got {page.url}"

    # 6. Apply global filter 'nguyen' via Enter -> resets to page 1, 3 rows, q in URL.
    page.fill('[data-testid="global-filter"]', "nguyen")
    page.press('[data-testid="global-filter"]', "Enter")
    _wait_until(page, lambda pg: _names(pg) == NGUYEN_NAMES, f"filtered rows == {NGUYEN_NAMES}")
    _wait_until(page, lambda pg: _total(pg) == 3, "total-count == 3 after filter")
    assert "q=nguyen" in _url(page), f"URL must contain q=nguyen after filter, got {page.url}"

    # 7. Browser Back -> previous (unfiltered) state: salary desc, page 2.
    page.go_back()
    _wait_until(page, lambda pg: _names(pg)[:1] == ["Ivy Martinez"], "after back, page-2 top row = Ivy Martinez")
    _wait_until(page, lambda pg: _total(pg) == 24, "after back, total-count == 24")
    assert "q=nguyen" not in _url(page), f"after back the q filter must be gone, got {page.url}"

    # 8. Browser Forward -> filtered state again.
    page.go_forward()
    _wait_until(page, lambda pg: _names(pg) == NGUYEN_NAMES, "after forward, filtered rows restored")
    _wait_until(page, lambda pg: _total(pg) == 3, "after forward, total-count == 3")


# ---------------------------------------------------------------------------
# Stack check (secondary, non-runtime signal): the app uses the TanStack stack.
# ---------------------------------------------------------------------------
def test_uses_tanstack_stack(start_app):
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"{pkg_path} must exist"
    import json

    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}) or {})
    deps.update(pkg.get("devDependencies", {}) or {})
    for required in ["@tanstack/react-start", "@tanstack/react-router", "@tanstack/react-table", "zod"]:
        assert required in deps, f"package.json must depend on {required}; got deps={sorted(deps)}"
