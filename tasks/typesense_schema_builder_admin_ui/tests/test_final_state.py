import os
import socket
import subprocess

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

# --- Connection facts (IPv4 loopback explicitly; never use "localhost") --------
HOST = "127.0.0.1"

PROJECT_DIR = "/home/user/admin-ui"
START_SCRIPT = "/home/user/admin-ui/start.sh"
DATASET_PATH = "/home/user/dataset/products.jsonl"
RUN_ID_PATH = "/logs/artifacts/run-id"

APP_PORT = 3000
APP_URL = f"http://{HOST}:{APP_PORT}"

TS_PORT = 8108
TS_URL = f"http://{HOST}:{TS_PORT}"
TS_BINARY = "/usr/local/bin/typesense-server"
TS_DATA_DIR = "/tmp/typesense-data"
with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()
TS_HEADERS = {"X-TYPESENSE-API-KEY": API_KEY}

BASE_COLLECTION = "catalog"
BAD_BASE_COLLECTION = "catalog_bad"


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def _read_run_id():
    assert os.path.isfile(RUN_ID_PATH), f"run-id file not found at {RUN_ID_PATH}."
    with open(RUN_ID_PATH, encoding="utf-8") as f:
        rid = f.read().strip()
    assert rid, f"run-id file {RUN_ID_PATH} is empty."
    return rid


def _drop_collection(name):
    try:
        requests.delete(f"{TS_URL}/collections/{name}", headers=TS_HEADERS, timeout=15)
    except requests.RequestException:
        pass


# ------------------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------------------
@pytest.fixture(scope="session")
def run_id():
    return _read_run_id()


@pytest.fixture(scope="session")
def typesense_server(xprocess):
    os.makedirs(TS_DATA_DIR, exist_ok=True)

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            TS_BINARY,
            f"--data-dir={TS_DATA_DIR}",
            f"--api-key={API_KEY}",
            f"--port={TS_PORT}",
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
                resp = requests.get(f"{TS_URL}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        try:
            with open(info.logpath) as f:
                print("===== [typesense_server] log =====")
                print(f.read())
        except OSError:
            pass
    assert started, "Typesense server failed to start."
    yield
    info.terminate()


@pytest.fixture(scope="session")
def reset_collections(typesense_server, run_id):
    """Ensure the executor's app performs the real creation by clearing any
    pre-existing run-id-scoped collections before the UI flow runs."""
    scoped = f"{BASE_COLLECTION}_{run_id}"
    bad_scoped = f"{BAD_BASE_COLLECTION}_{run_id}"
    for name in (scoped, bad_scoped, BASE_COLLECTION, BAD_BASE_COLLECTION):
        _drop_collection(name)
    return {"scoped": scoped, "bad_scoped": bad_scoped}


@pytest.fixture(scope="session")
def app_server(xprocess, typesense_server, reset_collections):
    class Starter(ProcessStarter):
        name = "admin_ui_app"
        args = ["bash", START_SCRIPT]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, APP_PORT)) != 0:
                    return False
            try:
                resp = requests.get(APP_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        try:
            with open(info.logpath) as f:
                print("===== [admin_ui_app] log =====")
                print(f.read())
        except OSError:
            pass
    assert started, "Admin UI app failed to start."
    yield
    info.terminate()


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def ui_flow(app_server, reset_collections, browser_verifier):
    """Drive the full multi-step UI workflow once via the browser agent."""
    with open(DATASET_PATH, encoding="utf-8") as f:
        dataset = f.read().strip()

    reason = (
        "The admin UI must let an operator build a Typesense collection schema, create the "
        "collection, bulk-import dirty JSON documents with type coercion, search the new "
        "collection, and reject an invalid schema with a visible error."
    )
    truth = f"""Navigate to {APP_URL}.

STEP 1 (build schema and create collection):
- In the input with id "collection-name", type: catalog
- Add these six fields one at a time. For each field, type the name into the input with id "field-name", choose the type in the select with id "field-type", set the checkbox id "field-facet" and the checkbox id "field-optional" as specified, then click the button with id "add-field":
  1. name "title", type "string", facet OFF, optional OFF
  2. name "brand", type "string", facet ON, optional OFF
  3. name "price", type "float", facet OFF, optional OFF
  4. name "rating", type "int", facet OFF, optional ON
  5. name "tags", type "string[]", facet ON, optional ON
  6. name "in_stock", type "bool", facet ON, optional OFF
- Click the button with id "create-collection".
- Verify the element with id "schema-status" shows a success message (not an error).

STEP 2 (import dirty data):
- Paste the following newline-delimited JSON EXACTLY into the textarea with id "import-data":
{dataset}
- Click the button with id "import-docs".
- Verify the element with id "imported-count" displays the number 4.
- Verify the element with id "rejected-count" displays the number 2.

STEP 3 (search):
- Type "mouse" into the input with id "search-query" and click the button with id "search-btn".
- Verify that the container with id "search-results" contains at least one element with CSS class "hit", and that one hit displays the title "Wireless Mouse".

STEP 4 (invalid schema is rejected):
- Reload {APP_URL}.
- In the input with id "collection-name", type: catalog_bad
- Add TWO fields that both have the name "title" with type "string" (using id "field-name", id "field-type", and id "add-field" for each).
- Click the button with id "create-collection".
- Verify the element with id "schema-status" shows a visible ERROR message (creation must fail).

Report pass only if ALL of the above verifications hold."""

    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_ui_flow",
    )
    return result


# ------------------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------------------
def test_ui_workflow_passes(ui_flow):
    assert ui_flow.status == "pass", f"Browser verification failed: {ui_flow.reason}"


def test_collection_created_with_expected_schema(ui_flow, reset_collections):
    scoped = reset_collections["scoped"]
    resp = requests.get(f"{TS_URL}/collections/{scoped}", headers=TS_HEADERS, timeout=15)
    assert resp.status_code == 200, (
        f"Expected run-id-scoped collection '{scoped}' to exist (HTTP 200), "
        f"got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    fields = {f["name"]: f for f in body.get("fields", [])}

    assert fields.get("title", {}).get("type") == "string", "Field 'title' must be type string."
    assert fields.get("brand", {}).get("type") == "string", "Field 'brand' must be type string."
    assert fields.get("brand", {}).get("facet") is True, "Field 'brand' must be a facet."
    assert fields.get("price", {}).get("type") == "float", "Field 'price' must be type float."
    assert fields.get("rating", {}).get("type") == "int32", (
        "Field 'rating' (form type 'int') must be stored as Typesense int32."
    )
    assert fields.get("rating", {}).get("optional") is True, "Field 'rating' must be optional."
    assert fields.get("tags", {}).get("type") == "string[]", "Field 'tags' must be type string[]."
    assert fields.get("tags", {}).get("facet") is True, "Field 'tags' must be a facet."
    assert fields.get("tags", {}).get("optional") is True, "Field 'tags' must be optional."
    assert fields.get("in_stock", {}).get("type") == "bool", "Field 'in_stock' must be type bool."
    assert fields.get("in_stock", {}).get("facet") is True, "Field 'in_stock' must be a facet."


def test_unscoped_collection_not_created(ui_flow):
    """Anti-cheat: the run-id must be applied; the un-suffixed base name must not exist."""
    resp = requests.get(
        f"{TS_URL}/collections/{BASE_COLLECTION}", headers=TS_HEADERS, timeout=15
    )
    assert resp.status_code == 404, (
        f"Un-scoped collection '{BASE_COLLECTION}' must not exist (run-id must be applied); "
        f"got HTTP {resp.status_code}."
    )


def test_document_count_is_four(ui_flow, reset_collections):
    scoped = reset_collections["scoped"]
    resp = requests.get(f"{TS_URL}/collections/{scoped}", headers=TS_HEADERS, timeout=15)
    assert resp.status_code == 200, f"Collection '{scoped}' not found: {resp.text}"
    num_docs = resp.json().get("num_documents")
    assert num_docs == 4, f"Expected 4 imported documents in '{scoped}', got {num_docs}."


def test_importable_rows_indexed_and_coerced(ui_flow, reset_collections):
    scoped = reset_collections["scoped"]
    for doc_id in ("p1", "p2", "p3", "p4"):
        resp = requests.get(
            f"{TS_URL}/collections/{scoped}/documents/{doc_id}",
            headers=TS_HEADERS,
            timeout=15,
        )
        assert resp.status_code == 200, (
            f"Importable document '{doc_id}' should be indexed, got HTTP {resp.status_code}."
        )
    # p2 arrived with a stringified price and must be coerced to a float.
    p2 = requests.get(
        f"{TS_URL}/collections/{scoped}/documents/p2", headers=TS_HEADERS, timeout=15
    ).json()
    assert isinstance(p2.get("price"), (int, float)) and not isinstance(p2.get("price"), bool), (
        f"Document p2 'price' must be coerced to a number, got {p2.get('price')!r}."
    )
    assert abs(float(p2["price"]) - 89.99) < 0.01, (
        f"Document p2 'price' should coerce to 89.99, got {p2.get('price')!r}."
    )
    # p4 arrived with a stringified integer price and must coerce to a number.
    p4 = requests.get(
        f"{TS_URL}/collections/{scoped}/documents/p4", headers=TS_HEADERS, timeout=15
    ).json()
    assert isinstance(p4.get("price"), (int, float)) and not isinstance(p4.get("price"), bool), (
        f"Document p4 'price' must be coerced to a number, got {p4.get('price')!r}."
    )
    assert abs(float(p4["price"]) - 45.0) < 0.01, (
        f"Document p4 'price' should coerce to 45, got {p4.get('price')!r}."
    )


def test_rejected_rows_not_indexed(ui_flow, reset_collections):
    scoped = reset_collections["scoped"]
    for doc_id in ("p5", "p6"):
        resp = requests.get(
            f"{TS_URL}/collections/{scoped}/documents/{doc_id}",
            headers=TS_HEADERS,
            timeout=15,
        )
        assert resp.status_code == 404, (
            f"Rejected row '{doc_id}' must NOT be indexed, got HTTP {resp.status_code}."
        )


def test_search_returns_expected_hit(ui_flow, reset_collections):
    scoped = reset_collections["scoped"]
    resp = requests.get(
        f"{TS_URL}/collections/{scoped}/documents/search",
        headers=TS_HEADERS,
        params={"q": "mouse", "query_by": "title"},
        timeout=15,
    )
    assert resp.status_code == 200, f"Search request failed: {resp.text}"
    hits = resp.json().get("hits", [])
    titles = [h.get("document", {}).get("title") for h in hits]
    assert "Wireless Mouse" in titles, (
        f"Search for 'mouse' should return the 'Wireless Mouse' document, got titles {titles}."
    )


def test_invalid_schema_collection_absent(ui_flow, reset_collections):
    bad_scoped = reset_collections["bad_scoped"]
    resp = requests.get(
        f"{TS_URL}/collections/{bad_scoped}", headers=TS_HEADERS, timeout=15
    )
    assert resp.status_code == 404, (
        f"Invalid-schema collection '{bad_scoped}' must NOT be created, got HTTP {resp.status_code}."
    )
