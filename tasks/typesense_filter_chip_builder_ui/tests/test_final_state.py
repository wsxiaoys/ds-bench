import os
import shutil
import socket

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

# Bind/connect over IPv4 explicitly. `localhost` can resolve to the IPv6
# loopback (::1) on some runtimes, which causes readiness checks to hang.
HOST = "127.0.0.1"

TS_BINARY = "/usr/local/bin/typesense-server"
TS_PORT = 8108
TS_DATA_DIR = "/tmp/ts-final-data"
with open("/etc/typesense-api-key", "r") as f:
    TS_API_KEY = f.read().strip()
TS_BASE = f"http://{HOST}:{TS_PORT}"

APP_PROJECT_DIR = "/home/user/filterchip"
APP_PORT = 8080
APP_BASE = f"http://{HOST}:{APP_PORT}"
FILTER_URL = f"{APP_BASE}/api/filter"

ALL_IDS = {str(i) for i in range(1, 13)}


# ----------------------------------------------------------------------------
# Fixtures: start Typesense, then the web application.
# ----------------------------------------------------------------------------
def _capture_logger(xprocess, name):
    info = xprocess.getinfo(name)
    state = {"printed": 0}

    def capture(tag):
        try:
            with open(info.logpath, "r") as f:
                lines = f.readlines()
        except OSError:
            return
        new_lines = lines[state["printed"]:]
        state["printed"] = len(lines)
        print(f"===== [{tag}] {name} log begin =====")
        print("".join(new_lines))
        print(f"===== [{tag}] {name} log end =====")

    return info, capture


@pytest.fixture(scope="session")
def typesense_server(xprocess):
    # Start from a clean data directory so the app must index the seed dataset.
    if os.path.isdir(TS_DATA_DIR):
        shutil.rmtree(TS_DATA_DIR)
    os.makedirs(TS_DATA_DIR, exist_ok=True)

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            TS_BINARY,
            f"--data-dir={TS_DATA_DIR}",
            f"--api-key={TS_API_KEY}",
            f"--api-address={HOST}",
            f"--api-port={TS_PORT}",
            "--enable-cors",
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": "/tmp", "text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, TS_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{TS_BASE}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except requests.RequestException:
                return False

    info, capture = _capture_logger(xprocess, Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture("STARTED" if started else "FAILED")

    yield TS_BASE

    capture("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def start_app(typesense_server, xprocess):
    app_env = os.environ.copy()
    # Ensure the app authenticates against the same Typesense server the verifier
    # launched, regardless of whether the key was injected or defaulted.

    class Starter(ProcessStarter):
        name = "filterchip_app"
        args = ["bash", os.path.join(APP_PROJECT_DIR, "start.sh")]
        env = app_env
        popen_kwargs = {"cwd": APP_PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, APP_PORT)) != 0:
                    return False
            # Readiness includes the dataset being fully indexed: an empty AND
            # group must match every one of the 12 seeded documents.
            try:
                resp = requests.post(
                    FILTER_URL,
                    json={"filter": {"op": "and", "children": []}},
                    timeout=20,
                )
                if resp.status_code != 200:
                    return False
                data = resp.json()
                return set(map(str, data.get("ids", []))) == ALL_IDS
            except (requests.RequestException, ValueError):
                return False

    info, capture = _capture_logger(xprocess, Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture("STARTED" if started else "FAILED")

    yield APP_BASE

    capture("TEARDOWN")
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


def _post_filter(body):
    return requests.post(FILTER_URL, json=body, timeout=30)


# ----------------------------------------------------------------------------
# Primary correctness checks via POST /api/filter
# ----------------------------------------------------------------------------
def test_nested_grouping_a(start_app):
    """category = Electronics AND (price in [40,100] OR tags in {home})."""
    body = {
        "filter": {
            "op": "and",
            "children": [
                {"field": "category", "cmp": "eq", "value": "Electronics"},
                {
                    "op": "or",
                    "children": [
                        {"field": "price", "cmp": "between", "value": [40, 100]},
                        {"field": "tags", "cmp": "in", "value": ["home"]},
                    ],
                },
            ],
        }
    }
    resp = _post_filter(body)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    ids = set(map(str, data.get("ids", [])))
    assert ids == {"2", "7", "10"}, f"Grouping A expected {{2,7,10}}, got {sorted(ids)}"
    assert data.get("count") == 3, f"Expected count 3, got {data.get('count')}"


def test_regrouped_b_precedence(start_app):
    """(category = Electronics AND price in [40,100]) OR tags in {home}.

    Same three leaves as grouping A but regrouped -> a different, larger set,
    proving grouping/precedence is honored and >10 matches are not truncated.
    """
    body = {
        "filter": {
            "op": "or",
            "children": [
                {
                    "op": "and",
                    "children": [
                        {"field": "category", "cmp": "eq", "value": "Electronics"},
                        {"field": "price", "cmp": "between", "value": [40, 100]},
                    ],
                },
                {"field": "tags", "cmp": "in", "value": ["home"]},
            ],
        }
    }
    resp = _post_filter(body)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    ids = set(map(str, data.get("ids", [])))
    expected = {"2", "5", "6", "7", "8", "10", "11", "12"}
    assert ids == expected, f"Grouping B expected {sorted(expected)}, got {sorted(ids)}"
    assert data.get("count") == 8, f"Expected count 8, got {data.get('count')}"


def test_special_character_escaping(start_app):
    """brand = 'Smith, Jones & Co.' AND price > 15 -> literal match of a value
    containing a comma and an ampersand."""
    body = {
        "filter": {
            "op": "and",
            "children": [
                {"field": "brand", "cmp": "eq", "value": "Smith, Jones & Co."},
                {"field": "price", "cmp": "gt", "value": 15},
            ],
        }
    }
    resp = _post_filter(body)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    ids = set(map(str, data.get("ids", [])))
    assert ids == {"2", "12"}, f"Escaping case expected {{2,12}}, got {sorted(ids)}"
    assert data.get("count") == 2, f"Expected count 2, got {data.get('count')}"


def test_two_level_nesting_set_and_numeric(start_app):
    """category in {Furniture,Kitchen} AND (rating >= 4.5 OR price < 10)."""
    body = {
        "filter": {
            "op": "and",
            "children": [
                {"field": "category", "cmp": "in", "value": ["Furniture", "Kitchen"]},
                {
                    "op": "or",
                    "children": [
                        {"field": "rating", "cmp": "gte", "value": 4.5},
                        {"field": "price", "cmp": "lt", "value": 10},
                    ],
                },
            ],
        }
    }
    resp = _post_filter(body)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    ids = set(map(str, data.get("ids", [])))
    assert ids == {"5", "12"}, f"Two-level case expected {{5,12}}, got {sorted(ids)}"
    assert data.get("count") == 2, f"Expected count 2, got {data.get('count')}"


def test_empty_group_matches_all(start_app):
    """An AND group with no children applies no constraint -> all 12 docs."""
    resp = _post_filter({"filter": {"op": "and", "children": []}})
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    ids = set(map(str, data.get("ids", [])))
    assert ids == ALL_IDS, f"Empty group expected all 12 ids, got {sorted(ids)}"
    assert data.get("count") == 12, f"Expected count 12, got {data.get('count')}"


def test_invalid_field_returns_400(start_app):
    """A condition referencing an unknown field must be rejected with 400."""
    resp = _post_filter(
        {"filter": {"field": "color", "cmp": "eq", "value": "red"}}
    )
    assert resp.status_code == 400, (
        f"Expected 400 for unknown field, got {resp.status_code}: {resp.text}"
    )


# ----------------------------------------------------------------------------
# Browser verification of the chip-building UI
# ----------------------------------------------------------------------------
def test_browser_build_nested_filter(start_app, browser_verifier):
    reason = (
        "The app is a visual filter-chip builder. The user must be able to add "
        "condition chips and nest AND/OR groups, apply the composed filter, and "
        "see the exact matching products."
    )
    truth = (
        f"Navigate to {APP_BASE}/ . Using the filter builder controls, construct a "
        "top-level AND group that contains: (a) a condition chip meaning "
        "category equals 'Electronics', and (b) a nested OR group containing a chip "
        "meaning price is between 40 and 100, and a chip meaning tags includes 'home'. "
        "Apply/run the filter. Verify the results area lists exactly the products with "
        "ids 2, 7 and 10 (three matches, shown with a total count of 3) and does not "
        "list any other product id."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_build_nested_filter",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_regrouping_changes_results(start_app, browser_verifier):
    reason = (
        "Grouping/precedence in the visual builder must affect the applied filter, so "
        "the same leaf conditions grouped differently produce a different result set."
    )
    truth = (
        f"Navigate to {APP_BASE}/ . Using the filter builder controls, construct a "
        "top-level OR group whose first child is an AND group containing a chip meaning "
        "category equals 'Electronics' and a chip meaning price is between 40 and 100, "
        "and whose second child is a chip meaning tags includes 'home'. Apply/run the "
        "filter. Verify the results area lists exactly the products with ids "
        "2, 5, 6, 7, 8, 10, 11 and 12 (eight matches, total count 8) — a larger, "
        "different set than a top-level AND grouping of the same conditions would give."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_regrouping_changes_results",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_special_character_value(start_app, browser_verifier):
    reason = (
        "A chip value containing characters significant to the filter grammar (comma, "
        "ampersand) must be matched literally through the UI."
    )
    truth = (
        f"Navigate to {APP_BASE}/ . Using the filter builder controls, construct a "
        "top-level AND group containing a condition chip meaning brand equals "
        "'Smith, Jones & Co.' and a condition chip meaning price is greater than 15. "
        "Apply/run the filter. Verify the results area lists exactly the products with "
        "ids 2 and 12 (two matches, total count 2)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_special_character_value",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
