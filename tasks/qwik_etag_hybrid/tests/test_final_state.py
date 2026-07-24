import json
import os
import re
import socket
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/qwik-etag-hybrid"
DB_PATH = "/home/user/qwik-etag-hybrid/data/catalog.db"
DIST_DIR = "/home/user/qwik-etag-hybrid/dist"
SENTINEL = "__CATALOG_SERVER_SECRET__"

PORT = 4173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the preview server may listen on ::1 only while an
# AF_INET socket to 127.0.0.1 never connects.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
CATALOG_URL = f"{BASE_URL}/catalog"


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "qwik_preview"
        # `npm run preview` must build the production bundle and serve it.
        # Extra args are appended to the underlying `vite preview` invocation so
        # the server binds the IPv4 loopback on the required port.
        args = ["npm", "run", "preview", "--", "--host", HOST, "--port", str(PORT)]
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
                resp = requests.get(CATALOG_URL, headers={"Accept": "application/json"}, timeout=20)
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


@pytest.fixture(scope="session")
def baseline(start_app):
    """Capture the unmodified JSON payload bytes and ETag before any mutation."""
    resp = requests.get(CATALOG_URL, headers={"Accept": "application/json"}, timeout=30)
    assert resp.status_code == 200, f"Baseline JSON GET failed with status {resp.status_code}"
    etag = resp.headers.get("ETag")
    assert etag, "Baseline JSON response is missing an ETag header."
    return resp.content, etag


def _get_json(extra_headers=None):
    headers = {"Accept": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    return requests.get(CATALOG_URL, headers=headers, timeout=30)


# 1. JSON shape
def test_json_shape(baseline):
    resp = _get_json()
    assert resp.status_code == 200, f"Expected 200 for JSON GET, got {resp.status_code}"
    assert "application/json" in resp.headers.get("Content-Type", ""), \
        f"Expected application/json Content-Type, got {resp.headers.get('Content-Type')}"
    body = resp.json()
    assert isinstance(body, dict) and "products" in body, "JSON body must be an object with a 'products' array."
    products = body["products"]
    assert isinstance(products, list) and len(products) >= 1, "'products' must be a non-empty array."
    for p in products:
        assert isinstance(p.get("id"), int), f"product id must be an integer: {p}"
        assert isinstance(p.get("name"), str), f"product name must be a string: {p}"
        assert isinstance(p.get("priceCents"), int), f"product priceCents must be an integer: {p}"
        assert isinstance(p.get("stock"), int), f"product stock must be an integer: {p}"
    ids = [p["id"] for p in products]
    assert ids == sorted(ids), f"products must be sorted by id ascending, got ids {ids}"


# 2. Headers
def test_json_headers(baseline):
    resp = _get_json()
    assert resp.headers.get("Cache-Control", "").strip() == "no-cache", \
        f"Expected Cache-Control 'no-cache', got {resp.headers.get('Cache-Control')!r}"
    assert resp.headers.get("Vary", "").strip() == "Accept", \
        f"Expected Vary 'Accept', got {resp.headers.get('Vary')!r}"
    etag = resp.headers.get("ETag", "")
    assert etag, "Missing ETag header."
    assert not etag.startswith("W/"), f"ETag must be a strong validator (no 'W/' prefix), got {etag!r}"
    assert etag.startswith('"') and etag.endswith('"'), f"Strong ETag must be double-quoted, got {etag!r}"


# 3. Determinism
def test_json_deterministic(baseline):
    j1, e1 = baseline
    resp = _get_json()
    assert resp.content == j1, "JSON body bytes must be identical for unchanged data."
    assert resp.headers.get("ETag") == e1, "ETag must be identical for unchanged data."


# 4. Conditional GET -> 304
def test_conditional_get_304(baseline):
    _, e1 = baseline
    resp = _get_json({"If-None-Match": e1})
    assert resp.status_code == 304, f"Expected 304 for matching If-None-Match, got {resp.status_code}"
    assert resp.content == b"", f"304 response must have an empty body, got {len(resp.content)} bytes."
    assert resp.headers.get("ETag") == e1, "304 response must include the matching ETag."
    assert resp.headers.get("Vary", "").strip() == "Accept", "304 response must include Vary: Accept."


# 5. Not Acceptable
def test_unsupported_accept_406(start_app):
    resp = requests.get(CATALOG_URL, headers={"Accept": "application/xml"}, timeout=30)
    assert resp.status_code == 406, f"Expected 406 for unsupported Accept, got {resp.status_code}"


# 6. HTML representation consistent with JSON
def test_html_consistency(baseline):
    j1, _ = baseline
    resp = requests.get(CATALOG_URL, headers={"Accept": "text/html"}, timeout=30)
    assert resp.status_code == 200, f"Expected 200 for HTML GET, got {resp.status_code}"
    assert "text/html" in resp.headers.get("Content-Type", ""), \
        f"Expected text/html Content-Type, got {resp.headers.get('Content-Type')}"
    html = resp.text

    j1_obj = json.loads(j1.decode("utf-8"))
    for p in j1_obj["products"]:
        assert p["name"] in html, f"HTML page must visibly contain product name {p['name']!r}."

    # Extract the embedded catalog-data script and compare byte-for-byte with the JSON API body.
    embedded = None
    for m in re.finditer(r"<script([^>]*)>(.*?)</script>", html, re.DOTALL | re.IGNORECASE):
        attrs, inner = m.group(1), m.group(2)
        if 'id="catalog-data"' in attrs and "application/json" in attrs:
            embedded = inner
            break
    assert embedded is not None, 'Could not find <script type="application/json" id="catalog-data"> in the HTML.'
    assert embedded == j1.decode("utf-8"), \
        "Embedded catalog-data JSON must be byte-identical to the JSON API body."


# 7. Mutation changes ETag
def test_post_mutation_changes_etag(baseline):
    _, e1 = baseline
    payload = {"name": "zzz-probe", "priceCents": 1234, "stock": 7}
    resp = requests.post(CATALOG_URL, json=payload, timeout=30)
    assert resp.status_code == 201, f"Expected 201 for valid POST, got {resp.status_code}: {resp.text}"
    created = resp.json()
    assert isinstance(created.get("id"), int), f"POST response must include an integer id: {created}"
    assert created.get("name") == "zzz-probe", "POST response must echo the created name."
    assert created.get("priceCents") == 1234, "POST response must echo priceCents."
    assert created.get("stock") == 7, "POST response must echo stock."

    resp2 = _get_json()
    body = resp2.json()
    names = [p["name"] for p in body["products"]]
    assert "zzz-probe" in names, "Created product must appear in subsequent JSON GET."
    ids = [p["id"] for p in body["products"]]
    assert ids == sorted(ids), "products must remain sorted by id ascending after a POST."
    e2 = resp2.headers.get("ETag")
    assert e2 and e2 != e1, "ETag must change after a mutation."


# 8. Server assigns id (anti-cheat)
def test_server_assigns_id(start_app):
    payload = {"id": 999999, "name": "zzz-idcheck", "priceCents": 50, "stock": 1}
    resp = requests.post(CATALOG_URL, json=payload, timeout=30)
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    created = resp.json()
    assert created.get("id") != 999999, "Server must assign the id and ignore any client-supplied id."


# 9. Validation
@pytest.mark.parametrize(
    "payload",
    [
        {"name": "", "priceCents": 10, "stock": 1},
        {"name": "x", "priceCents": -1, "stock": 1},
        {"name": "x", "priceCents": 1.5, "stock": 1},
        {"name": "x", "priceCents": 10, "stock": -2},
    ],
)
def test_post_validation(start_app, payload):
    resp = requests.post(CATALOG_URL, json=payload, timeout=30)
    assert resp.status_code == 400, f"Expected 400 for invalid payload {payload}, got {resp.status_code}"


# 10. Concurrency
def test_concurrent_posts(start_app):
    pre = _get_json()
    c0 = len(pre.json()["products"])
    e_pre = pre.headers.get("ETag")

    def do_post(i):
        return requests.post(
            CATALOG_URL,
            json={"name": f"conc-{i}", "priceCents": 100, "stock": 1},
            timeout=60,
        )

    start = time.time()
    with ThreadPoolExecutor(max_workers=20) as ex:
        results = list(ex.map(do_post, range(20)))
    elapsed = time.time() - start
    assert elapsed < 120, f"Concurrent POSTs took too long ({elapsed:.1f}s); possible deadlock."

    for i, r in enumerate(results):
        assert r.status_code == 201, f"Concurrent POST conc-{i} failed with {r.status_code}: {r.text}"

    post = _get_json()
    products = post.json()["products"]
    assert len(products) == c0 + 20, \
        f"Expected {c0 + 20} products after 20 concurrent POSTs, got {len(products)} (lost writes)."
    names = {p["name"] for p in products}
    for i in range(20):
        assert f"conc-{i}" in names, f"Concurrent product conc-{i} was not persisted."
    assert post.headers.get("ETag") != e_pre, "ETag must change after concurrent mutations."


# 11. SQLite persistence
def test_sqlite_persistence(start_app):
    assert os.path.isfile(DB_PATH), f"Expected SQLite database file at {DB_PATH}."
    api_count = len(_get_json().json()["products"])

    conn = None
    last_err = None
    for _ in range(10):
        try:
            conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=5)
            row = conn.execute("SELECT COUNT(*) FROM products").fetchone()
            break
        except sqlite3.Error as e:
            last_err = e
            time.sleep(0.5)
        finally:
            pass
    else:
        raise AssertionError(f"Could not read products table from {DB_PATH}: {last_err}")

    assert conn is not None, f"Could not open SQLite database at {DB_PATH}: {last_err}"
    db_count = row[0]
    conn.close()
    assert db_count == api_count, \
        f"SQLite products row count ({db_count}) must equal API product count ({api_count})."


# 12. Client bundle purity
def test_client_bundle_has_no_server_code(start_app):
    assert os.path.isdir(DIST_DIR), f"Client build output directory {DIST_DIR} does not exist."
    offenders = []
    for root, _dirs, files in os.walk(DIST_DIR):
        for name in files:
            if not name.endswith((".js", ".mjs", ".cjs")):
                continue
            path = os.path.join(root, name)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    if SENTINEL in f.read():
                        offenders.append(path)
            except OSError:
                continue
    assert not offenders, \
        f"Server-only sentinel {SENTINEL!r} leaked into client bundle files: {offenders}"
