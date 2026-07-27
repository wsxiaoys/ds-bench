import os
import socket
import tempfile
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

# ---------------------------------------------------------------------------
# Constants / configuration
# ---------------------------------------------------------------------------
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so the app would listen on ::1 only while an AF_INET
# socket to 127.0.0.1 never connects -> readiness checks would hang.
HOST = "127.0.0.1"

PROJECT_DIR = "/home/user/trendsearch"
TYPESENSE_BINARY = "/usr/local/bin/typesense-server"

TYPESENSE_PORT = 8108
TYPESENSE_URL = f"http://{HOST}:{TYPESENSE_PORT}"

APP_PORT = 3000
BASE_URL = f"http://{HOST}:{APP_PORT}"

with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()
TS_HEADERS = {"X-TYPESENSE-API-KEY": API_KEY}

# Fresh, isolated on-disk directories for the Typesense server for this run.
_TS_DATA_DIR = tempfile.mkdtemp(prefix="ts-data-")
_TS_ANALYTICS_DIR = tempfile.mkdtemp(prefix="ts-analytics-")

# The set of terms driven through the search API and their frequencies.
# All terms below match at least one seeded product (they return hits).
DRIVE_PLAN = [
    ("laptop", 4),
    ("phone", 3),
    ("camera", 2),
    ("drone", 2),
    ("tablet", 1),
]
EXPECTED_TOP_TERMS = {"laptop", "phone", "camera", "drone", "tablet"}
NONSENSE_TERM = "zzzqqx"

# Typesense analytics aggregation is asynchronous (flush interval is 60s), so
# we poll the app's trending endpoint with a generous bounded wait.
TRENDING_POLL_TIMEOUT = 240
PAUSE_BETWEEN_SEARCHES = 5  # > the 4s aggregation debounce window


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        return s.connect_ex((host, port)) == 0


def _get_trending_list():
    """Return the `trending` array from GET /api/trending (or [] on any error)."""
    try:
        resp = requests.get(f"{BASE_URL}/api/trending", timeout=15)
        if resp.status_code != 200:
            return []
        data = resp.json()
        trending = data.get("trending")
        return trending if isinstance(trending, list) else []
    except (requests.RequestException, ValueError):
        return []


def _is_sorted_by_count_then_q(trending):
    """True if the list is ordered by count desc, then by q ascending."""
    for a, b in zip(trending, trending[1:]):
        ca, cb = a.get("count"), b.get("count")
        qa, qb = a.get("q"), b.get("q")
        if not isinstance(ca, int) or not isinstance(cb, int):
            return False
        if ca < cb:
            return False
        if ca == cb and str(qa) > str(qb):
            return False
    return True


def _drive_searches():
    """Run the DRIVE_PLAN searches through the app, spaced beyond the
    aggregation debounce window so each search is registered."""
    for term, times in DRIVE_PLAN:
        for _ in range(times):
            requests.get(f"{BASE_URL}/api/search", params={"q": term}, timeout=15)
            time.sleep(PAUSE_BETWEEN_SEARCHES)


def _poll_trending_until_ready():
    """Poll until the top-5 trending queries form the expected set and the
    list is correctly ordered. Returns the last observed trending list."""
    deadline = time.time() + TRENDING_POLL_TIMEOUT
    last = []
    while time.time() < deadline:
        last = _get_trending_list()
        top5 = last[:5]
        top5_terms = {e.get("q") for e in top5}
        if top5_terms == EXPECTED_TOP_TERMS and _is_sorted_by_count_then_q(last):
            return last
        time.sleep(4)
    return last


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


def _make_log_capturer(xprocess, name):
    info = xprocess.getinfo(name)
    state = {"printed": 0}

    def capture_logs(tag):
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            return
        new_lines = all_lines[state["printed"]:]
        state["printed"] = len(all_lines)
        print(f"===== [{tag}] {name} log begin =====")
        print("".join(new_lines))
        print(f"===== [{tag}] {name} log end   =====")

    return info, capture_logs


@pytest.fixture(scope="session")
def typesense_server(xprocess):
    """Start a native Typesense v26.0 server with search-analytics enabled."""

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            TYPESENSE_BINARY,
            f"--data-dir={_TS_DATA_DIR}",
            f"--api-key={API_KEY}",
            "--enable-cors",
            "--enable-search-analytics=true",
            f"--analytics-dir={_TS_ANALYTICS_DIR}",
            "--analytics-flush-interval=60",
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            if not _port_open(HOST, TYPESENSE_PORT):
                return False
            try:
                resp = requests.get(f"{TYPESENSE_URL}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except (requests.RequestException, ValueError):
                return False

    info, capture_logs = _make_log_capturer(xprocess, Starter.name)
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
def start_app(xprocess, typesense_server):
    """Start the search web app; it connects to Typesense and seeds the catalog."""

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "start"]
        env = os.environ.copy()
        env["PORT"] = str(APP_PORT)
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            if not _port_open(HOST, APP_PORT):
                return False
            try:
                # The app must have finished indexing so that searches work.
                resp = requests.get(
                    f"{BASE_URL}/api/search", params={"q": "laptop"}, timeout=20
                )
                if resp.status_code != 200:
                    return False
                return isinstance(resp.json().get("found"), int)
            except (requests.RequestException, ValueError):
                return False

    info, capture_logs = _make_log_capturer(xprocess, Starter.name)
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
def analytics_state(start_app):
    """Drive the search workload once, then poll until trending is populated."""
    _drive_searches()
    trending = _poll_trending_until_ready()
    return trending


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_catalog_search_returns_hits(start_app):
    resp = requests.get(f"{BASE_URL}/api/search", params={"q": "laptop"}, timeout=20)
    assert resp.status_code == 200, f"/api/search?q=laptop returned {resp.status_code}"
    data = resp.json()
    assert data.get("query") == "laptop", f"Expected query 'laptop', got {data.get('query')!r}"
    assert isinstance(data.get("found"), int) and data["found"] >= 1, (
        f"Expected found >= 1 for 'laptop', got {data.get('found')!r}"
    )
    hits = data.get("hits")
    assert isinstance(hits, list) and len(hits) >= 1, "Expected a non-empty 'hits' array."
    for hit in hits:
        assert "id" in hit and "name" in hit, f"Each hit must include 'id' and 'name': {hit}"
    assert any("laptop" in str(h.get("name", "")).lower() for h in hits), (
        "Expected at least one hit whose name contains 'laptop'."
    )


def test_zero_hit_search_returns_suggestions(start_app):
    resp = requests.get(
        f"{BASE_URL}/api/search", params={"q": NONSENSE_TERM}, timeout=20
    )
    assert resp.status_code == 200, f"/api/search?q={NONSENSE_TERM} returned {resp.status_code}"
    data = resp.json()
    assert data.get("found") == 0, f"Expected found == 0 for '{NONSENSE_TERM}', got {data.get('found')!r}"
    assert data.get("hits") == [], f"Expected empty hits for '{NONSENSE_TERM}', got {data.get('hits')!r}"
    suggestions = data.get("suggestions")
    assert isinstance(suggestions, list) and len(suggestions) >= 1, (
        "Expected a non-empty 'suggestions' array for a zero-hit query."
    )
    assert all(isinstance(s, str) for s in suggestions), (
        f"All suggestions must be strings, got {suggestions!r}"
    )


def test_native_analytics_rules_configured(start_app):
    resp = requests.get(f"{TYPESENSE_URL}/analytics/rules", headers=TS_HEADERS, timeout=15)
    assert resp.status_code == 200, f"GET /analytics/rules returned {resp.status_code}"
    payload = resp.json()
    rules = payload.get("rules", payload if isinstance(payload, list) else [])
    assert isinstance(rules, list) and rules, f"Expected a non-empty list of analytics rules, got {payload!r}"

    def _sources(rule):
        params = rule.get("params", {}) or {}
        source = params.get("source", {}) or {}
        return source.get("collections", []) or []

    popular = [r for r in rules if r.get("type") == "popular_queries" and "catalog" in _sources(r)]
    nohits = [r for r in rules if r.get("type") == "nohits_queries" and "catalog" in _sources(r)]
    assert popular, "Expected a 'popular_queries' analytics rule sourced from the 'catalog' collection."
    assert nohits, "Expected a 'nohits_queries' analytics rule sourced from the 'catalog' collection."


def test_trending_ranking(analytics_state):
    trending = analytics_state
    assert isinstance(trending, list) and len(trending) >= 5, (
        f"Expected at least 5 trending entries after the driven workload, got {trending!r}"
    )
    top5 = trending[:5]
    top5_terms = {e.get("q") for e in top5}
    assert top5_terms == EXPECTED_TOP_TERMS, (
        f"Top-5 trending queries {top5_terms} != expected {EXPECTED_TOP_TERMS}."
    )
    assert _is_sorted_by_count_then_q(trending), (
        f"Trending must be ordered by count desc then q asc; got {trending!r}"
    )
    for e in top5:
        assert isinstance(e.get("count"), int) and e["count"] > 0, (
            f"Every trending count must be a positive integer: {e!r}"
        )

    by_q = {e["q"]: e["count"] for e in top5}
    assert top5[0]["q"] == "laptop", f"Expected 'laptop' as the top trending query, got {top5[0]['q']!r}"
    assert top5[4]["q"] == "tablet", f"Expected 'tablet' as the 5th trending query, got {top5[4]['q']!r}"
    assert by_q["laptop"] > by_q["tablet"], "Expected 'laptop' to have a higher count than 'tablet'."

    # camera and drone were searched the same number of times -> tie broken by
    # query string ascending, so 'camera' must appear before 'drone'.
    order = [e["q"] for e in top5]
    assert order.index("camera") < order.index("drone"), (
        f"Tie-break failed: 'camera' must precede 'drone' in {order}."
    )


def test_zero_hit_suggestions_reflect_popularity(analytics_state):
    # After the workload, the top trending query is 'laptop'; a zero-hit search
    # must surface it as the first suggested alternative.
    deadline = time.time() + 30
    first = None
    while time.time() < deadline:
        resp = requests.get(
            f"{BASE_URL}/api/search", params={"q": NONSENSE_TERM}, timeout=20
        )
        assert resp.status_code == 200, f"/api/search?q={NONSENSE_TERM} returned {resp.status_code}"
        suggestions = resp.json().get("suggestions") or []
        if suggestions:
            first = suggestions[0]
            if first == "laptop":
                break
        time.sleep(3)
    assert first == "laptop", (
        f"Expected the first zero-hit suggestion to be the top trending query 'laptop', got {first!r}"
    )


def test_browser_trending_and_zero_hit_ui(analytics_state, browser_verifier):
    reason = (
        "The search app must render a live 'Trending searches' widget reflecting "
        "the most-searched queries, a working search box over the product catalog, "
        "and a zero-results suggestions panel."
    )
    truth = (
        f"Navigate to {BASE_URL}. "
        "Confirm the page has a search text input with id 'search-input' and a "
        "'Trending searches' widget with id 'trending'. "
        "Inside the element with id 'trending', read the elements with class "
        "'trending-item' from top to bottom; confirm the first five, in order, "
        "contain the query texts: 'laptop', then 'phone', then 'camera', then "
        "'drone', then 'tablet'. "
        "Click the input with id 'search-input', type 'laptop', and press Enter; "
        "confirm the element with id 'results' then shows at least one element "
        "with class 'result-item' whose text contains 'Laptop'. "
        "Clear the input, type 'zzzqqx', and press Enter; confirm the element "
        "with id 'no-results' becomes visible and that the element with id "
        "'suggestions' lists at least one element with class 'suggestion-item'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_trending_and_zero_hit_ui",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
