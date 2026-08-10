import os
import socket
import subprocess
import tempfile
import time
import shutil

import pytest
import requests
from pochi_verifier import PochiVerifier

# --- Constants -------------------------------------------------------------
PROJECT_DIR = "/home/user/saved-search-alerts"
TYPESENSE_BIN = "/usr/local/bin/typesense-server"
with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()

# Always use the IPv4 loopback explicitly. On some runtimes `localhost` resolves
# to the IPv6 loopback (::1), which would make readiness checks hang.
TS_HOST = "127.0.0.1"
TS_PORT = 8108
TS_URL = f"http://{TS_HOST}:{TS_PORT}"

APP_HOST = "127.0.0.1"
APP_PORT = 8080
BASE_URL = f"http://{APP_HOST}:{APP_PORT}"

TS_HEADERS = {"X-TYPESENSE-API-KEY": API_KEY}

# Ingest catalog documents used by the API workflow.
DOC_I1 = {"id": "i1", "name": "Solaris Wireless Earbuds", "category": "electronics", "price": 120}
DOC_I2 = {"id": "i2", "name": "Galaxy USB Charger", "category": "electronics", "price": 45}
DOC_I3 = {"id": "i3", "name": "Wireless Garden Doorbell", "category": "toys", "price": 60}


# --- Low-level helpers -----------------------------------------------------
def _port_open(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex((host, port)) == 0


def _wait(predicate, timeout, interval=0.5):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            last = predicate()
            if last:
                return last
        except Exception as exc:  # noqa: BLE001
            last = exc
        time.sleep(interval)
    return last


def _ts_health_ok():
    try:
        r = requests.get(f"{TS_URL}/health", timeout=3)
        return r.status_code == 200 and r.json().get("ok") is True
    except requests.RequestException:
        return False


def _app_root_ok():
    try:
        r = requests.get(BASE_URL, timeout=10)
        return r.status_code < 500
    except requests.RequestException:
        return False


def ts_search(q, filter_by=None, query_by="name", per_page=250):
    params = {"q": q, "query_by": query_by, "per_page": per_page}
    if filter_by:
        params["filter_by"] = filter_by
    return requests.get(
        f"{TS_URL}/collections/products/documents/search",
        params=params,
        headers=TS_HEADERS,
        timeout=10,
    )


def ts_found(q, filter_by=None):
    r = ts_search(q, filter_by=filter_by)
    assert r.status_code == 200, f"Typesense search failed ({r.status_code}): {r.text}"
    return r.json().get("found")


def _baseline_seeded():
    if not _ts_health_ok():
        return False
    r = ts_search("*")
    if r.status_code != 200:
        return False
    return r.json().get("found") == 6


# --- Service lifecycle fixture --------------------------------------------
class _Services:
    def __init__(self):
        self.data_dir = tempfile.mkdtemp(prefix="ts-data-")
        self.ts_log = tempfile.NamedTemporaryFile(prefix="ts-", suffix=".log", delete=False)
        self.app_log = tempfile.NamedTemporaryFile(prefix="app-", suffix=".log", delete=False)
        self.ts_proc = None
        self.app_proc = None

    def start(self):
        # 1. Start a fresh Typesense server on an empty data directory.
        self.ts_proc = subprocess.Popen(
            [
                TYPESENSE_BIN,
                f"--data-dir={self.data_dir}",
                f"--api-key={API_KEY}",
                f"--api-address={TS_HOST}",
                f"--api-port={TS_PORT}",
                "--enable-cors",
            ],
            stdout=self.ts_log,
            stderr=subprocess.STDOUT,
        )
        assert _wait(_ts_health_ok, timeout=60), "Typesense server did not become healthy."

        # 2. Start the application; it must seed the baseline into Typesense.
        env = os.environ.copy()
        self.app_proc = subprocess.Popen(
            ["npm", "start"],
            cwd=PROJECT_DIR,
            env=env,
            stdout=self.app_log,
            stderr=subprocess.STDOUT,
        )
        assert _wait(lambda: _port_open(APP_HOST, APP_PORT), timeout=120), (
            "Application did not open port 8080."
        )
        assert _wait(_app_root_ok, timeout=60), "Application root did not respond."
        assert _wait(_baseline_seeded, timeout=60), (
            "Application did not seed the 6 baseline documents into Typesense."
        )

    def stop(self):
        for proc in (self.app_proc, self.ts_proc):
            if proc is not None:
                try:
                    proc.terminate()
                    proc.wait(timeout=15)
                except Exception:  # noqa: BLE001
                    try:
                        proc.kill()
                    except Exception:  # noqa: BLE001
                        pass
        # Wait for the ports to be released so the next scenario can rebind.
        _wait(lambda: not _port_open(TS_HOST, TS_PORT), timeout=15)
        _wait(lambda: not _port_open(APP_HOST, APP_PORT), timeout=15)
        for path in (self.ts_log.name, self.app_log.name):
            self._print_log(path)
        shutil.rmtree(self.data_dir, ignore_errors=True)

    @staticmethod
    def _print_log(path):
        try:
            with open(path) as f:
                content = f.read()
            print(f"===== log {path} =====\n{content}\n===== end {path} =====")
        except OSError:
            pass


@pytest.fixture
def services():
    svc = _Services()
    try:
        svc.start()
        yield svc
    finally:
        svc.stop()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


# --- API workflow ----------------------------------------------------------
def test_api_saved_search_workflow(services):
    # Baseline seeded correctly (anti-cheat: verified directly against Typesense).
    assert ts_found("*") == 6, "Expected 6 baseline documents in the products collection."
    assert ts_found("wireless") == 1, "Baseline: exactly 1 document should match name 'wireless'."
    assert ts_found("*", "category:=electronics && price:<=130") == 1, (
        "Baseline: exactly 1 electronics document priced <= 130."
    )

    # Create saved search A: query 'wireless', no category, no price cap.
    ra = requests.post(
        f"{BASE_URL}/api/saved-searches",
        json={"name": "Wireless Anything", "q": "wireless", "category": "", "max_price": None},
        timeout=15,
    )
    assert ra.status_code == 201, f"Creating saved search A failed: {ra.status_code} {ra.text}"
    a = ra.json()
    id_a = a["id"]
    assert a.get("match_count") is None, "New saved search A must have null match_count before first check."
    assert a.get("new_count") is None, "New saved search A must have null new_count before first check."

    # Create saved search B: query '*', category electronics, max price 130.
    rb = requests.post(
        f"{BASE_URL}/api/saved-searches",
        json={"name": "Budget Electronics", "q": "*", "category": "electronics", "max_price": 130},
        timeout=15,
    )
    assert rb.status_code == 201, f"Creating saved search B failed: {rb.status_code} {rb.text}"
    id_b = rb.json()["id"]

    # Initial check-all establishes baselines with 0 new.
    rc = requests.post(f"{BASE_URL}/api/check-all", timeout=20)
    assert rc.status_code == 200, f"check-all failed: {rc.status_code} {rc.text}"
    by_id = {o["id"]: o for o in rc.json()}
    assert by_id[id_a]["match_count"] == 1 and by_id[id_a]["new_count"] == 0, (
        f"Initial check A expected match_count=1,new_count=0, got {by_id[id_a]}"
    )
    assert by_id[id_b]["match_count"] == 1 and by_id[id_b]["new_count"] == 0, (
        f"Initial check B expected match_count=1,new_count=0, got {by_id[id_b]}"
    )

    # Ingest i1 (matches BOTH A and B), i2 (only B), i3 (only A).
    ri = requests.post(
        f"{BASE_URL}/api/ingest",
        json={"documents": [DOC_I1, DOC_I2, DOC_I3]},
        timeout=20,
    )
    assert ri.status_code == 200, f"ingest failed: {ri.status_code} {ri.text}"
    assert ri.json().get("ingested") == 3, f"Expected ingested=3, got {ri.json()}"

    # The ingested documents must really be in the live index.
    assert ts_found("*") == 9, "After ingest the collection should hold 9 documents."
    for doc_id in ("i1", "i2", "i3"):
        rd = requests.get(f"{TS_URL}/collections/products/documents/{doc_id}", headers=TS_HEADERS, timeout=10)
        assert rd.status_code == 200, f"Ingested document {doc_id} not retrievable from Typesense."
    assert ts_found("wireless") == 3, "Live index: 3 documents should match 'wireless' after ingest."
    assert ts_found("*", "category:=electronics && price:<=130") == 3, (
        "Live index: 3 electronics documents priced <= 130 after ingest."
    )

    # Re-check A: delta = i1, i3 -> 2 new; total 3.
    rca = requests.post(f"{BASE_URL}/api/saved-searches/{id_a}/check", timeout=15)
    assert rca.status_code == 200, f"check A failed: {rca.text}"
    a2 = rca.json()
    assert a2["match_count"] == 3 and a2["new_count"] == 2, (
        f"After ingest A expected match_count=3,new_count=2, got {a2}"
    )

    # Re-check B: delta = i1, i2 -> 2 new; total 3. (i1 correctly updates BOTH searches.)
    rcb = requests.post(f"{BASE_URL}/api/saved-searches/{id_b}/check", timeout=15)
    assert rcb.status_code == 200, f"check B failed: {rcb.text}"
    b2 = rcb.json()
    assert b2["match_count"] == 3 and b2["new_count"] == 2, (
        f"After ingest B expected match_count=3,new_count=2, got {b2}"
    )

    # Immediate re-check with no index change -> new resets to 0.
    rc2 = requests.post(f"{BASE_URL}/api/check-all", timeout=20)
    assert rc2.status_code == 200, f"second check-all failed: {rc2.text}"
    by_id2 = {o["id"]: o for o in rc2.json()}
    assert by_id2[id_a]["match_count"] == 3 and by_id2[id_a]["new_count"] == 0, (
        f"Re-check A expected match_count=3,new_count=0, got {by_id2[id_a]}"
    )
    assert by_id2[id_b]["match_count"] == 3 and by_id2[id_b]["new_count"] == 0, (
        f"Re-check B expected match_count=3,new_count=0, got {by_id2[id_b]}"
    )

    # Re-ingesting an already-present document is an upsert: no duplicate, no new match.
    rr = requests.post(f"{BASE_URL}/api/ingest", json={"documents": [DOC_I1]}, timeout=15)
    assert rr.status_code == 200 and rr.json().get("ingested") == 1, f"re-ingest i1 failed: {rr.text}"
    assert ts_found("*") == 9, "Re-ingesting an existing id must not create a duplicate document."
    rca2 = requests.post(f"{BASE_URL}/api/saved-searches/{id_a}/check", timeout=15)
    assert rca2.json()["match_count"] == 3 and rca2.json()["new_count"] == 0, (
        f"After re-ingest of existing i1, A expected match_count=3,new_count=0, got {rca2.json()}"
    )

    # Anti-cheat: add a document DIRECTLY to Typesense (bypassing the app). A
    # solution that only tracks its own ingest calls will miss it; a solution
    # that queries the live index will see it.
    imp = requests.post(
        f"{TS_URL}/collections/products/documents/import",
        params={"action": "upsert"},
        data='{"id":"x1","name":"Wireless Test Gadget","category":"toys","price":10}',
        headers={**TS_HEADERS, "Content-Type": "text/plain"},
        timeout=15,
    )
    assert imp.status_code == 200 and '"success":true' in imp.text.replace(" ", ""), (
        f"Direct Typesense import of x1 failed: {imp.status_code} {imp.text}"
    )
    assert ts_found("wireless") == 4, "Live index should show 4 'wireless' matches after external add."

    rca3 = requests.post(f"{BASE_URL}/api/saved-searches/{id_a}/check", timeout=15)
    a3 = rca3.json()
    assert a3["match_count"] == 4 and a3["new_count"] == 1, (
        f"After external add, A expected match_count=4,new_count=1, got {a3}"
    )
    rcb3 = requests.post(f"{BASE_URL}/api/saved-searches/{id_b}/check", timeout=15)
    b3 = rcb3.json()
    assert b3["match_count"] == 3 and b3["new_count"] == 0, (
        f"External add was a toy; B should be unchanged (match_count=3,new_count=0), got {b3}"
    )


# --- Browser workflow ------------------------------------------------------
def test_browser_saved_search_workflow(services, browser_verifier):
    reason = (
        "The app lets a user save named searches over a Typesense product catalog and check "
        "each saved search for its current match count and how many matches are new since the "
        "previous check. New documents can be ingested from a provided catalog, and re-checking "
        "must update match counts and new-match badges from the live index."
    )
    truth = (
        f"Navigate to {BASE_URL}. "
        "The page shows a form to create a saved search and an ingest section listing catalog "
        "documents including 'Solaris Wireless Earbuds', 'Galaxy USB Charger', and "
        "'Wireless Garden Doorbell'. "
        "Create a saved search named 'Wireless Anything' with query text 'wireless', no category, "
        "and no maximum price. "
        "Create a second saved search named 'Budget Electronics' with query text '*', category "
        "'electronics', and maximum price '130'. "
        "Both saved searches now appear in the saved-search list. "
        "Trigger 'Check all'. Verify that 'Wireless Anything' shows a match count of 1 with a new "
        "badge of 0, and 'Budget Electronics' shows a match count of 1 with a new badge of 0. "
        "In the ingest section, select the catalog documents 'Solaris Wireless Earbuds', "
        "'Galaxy USB Charger', and 'Wireless Garden Doorbell', and ingest them. "
        "Trigger 'Check all' again. Verify that 'Wireless Anything' now shows a match count of 3 "
        "with a new badge of 2, and 'Budget Electronics' shows a match count of 3 with a new badge "
        "of 2. "
        "Trigger 'Check all' once more. Verify that both saved searches show a new badge of 0 "
        "while their match counts remain 3."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_saved_search_workflow",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
