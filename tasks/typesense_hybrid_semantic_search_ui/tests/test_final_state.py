import os
import socket
import time

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

HOST = "127.0.0.1"

TYPESENSE_PORT = 8108
TYPESENSE_URL = f"http://{HOST}:{TYPESENSE_PORT}"
TYPESENSE_DATA_DIR = "/home/user/typesense-data"
with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()
COLLECTION = "knowledge_base"

APP_PORT = 8080
APP_URL = f"http://{HOST}:{APP_PORT}"
PROJECT_DIR = "/home/user/kbsearch"

EVAL_QUERY = "speed up slow website"
KEYWORD_TOP_TITLE = "Website Speed Myths"
SEMANTIC_TOP_TITLE = "Improving Page Load Performance"
NUM_DOCS = 8


def _capture_logs_factory(info, name):
    state = {"printed": 0}

    def capture_logs(tag):
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[state["printed"]:]
        skipped = state["printed"]
        state["printed"] = len(all_lines)
        print(f"===================== [{tag}: Begin] {name} logfile =====================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===================== [{tag}: End  ] {name} logfile =====================")

    return capture_logs


@pytest.fixture(scope="session")
def start_typesense(xprocess):
    os.makedirs(TYPESENSE_DATA_DIR, exist_ok=True)

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            "typesense-server",
            f"--data-dir={TYPESENSE_DATA_DIR}",
            f"--api-key={API_KEY}",
            f"--api-address={HOST}",
            f"--api-port={TYPESENSE_PORT}",
            "--enable-cors",
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, TYPESENSE_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{TYPESENSE_URL}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    capture_logs = _capture_logs_factory(info, Starter.name)
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
def start_app(xprocess, start_typesense):
    class Starter(ProcessStarter):
        name = "kbsearch_app"
        args = ["bash", os.path.join(PROJECT_DIR, "start.sh")]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
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
    capture_logs = _capture_logs_factory(info, Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield
    capture_logs("TEARDOWN")
    info.terminate()


def _search(mode, alpha=None):
    params = {"q": EVAL_QUERY, "mode": mode}
    if alpha is not None:
        params["alpha"] = alpha
    resp = requests.get(f"{APP_URL}/api/search", params=params, timeout=30)
    assert resp.status_code == 200, (
        f"/api/search mode={mode} alpha={alpha} returned {resp.status_code}: {resp.text[:400]}"
    )
    body = resp.json()
    assert isinstance(body, dict) and isinstance(body.get("results"), list), (
        f"/api/search response must be an object with a 'results' array, got: {body!r}"
    )
    assert len(body["results"]) > 0, f"Expected non-empty results for mode={mode} alpha={alpha}."
    top = body["results"][0]
    assert isinstance(top, dict) and "title" in top, (
        f"Each result must be an object containing a 'title'; got: {top!r}"
    )
    return body["results"]


def test_typesense_collection_populated(start_app):
    """The app must index all seeded documents (with embeddings) into the Typesense collection."""
    resp = requests.get(
        f"{TYPESENSE_URL}/collections/{COLLECTION}",
        headers={"X-TYPESENSE-API-KEY": API_KEY},
        timeout=30,
    )
    assert resp.status_code == 200, (
        f"Expected Typesense collection '{COLLECTION}' to exist (status 200), "
        f"got {resp.status_code}: {resp.text[:400]}"
    )
    schema = resp.json()
    assert schema.get("num_documents") == NUM_DOCS, (
        f"Expected {NUM_DOCS} documents in '{COLLECTION}', got {schema.get('num_documents')}."
    )
    fields = schema.get("fields", [])
    assert any(f.get("type") == "float[]" for f in fields), (
        "Expected the collection schema to contain a float[] (embedding) field so that "
        f"semantic search can work. Fields: {fields!r}"
    )


def test_keyword_mode_top_result(start_app):
    results = _search("keyword")
    assert results[0]["title"] == KEYWORD_TOP_TITLE, (
        f"Keyword mode top result should be '{KEYWORD_TOP_TITLE}', got '{results[0]['title']}'."
    )


def test_semantic_mode_top_result(start_app):
    results = _search("semantic")
    assert results[0]["title"] == SEMANTIC_TOP_TITLE, (
        f"Semantic mode top result should be '{SEMANTIC_TOP_TITLE}', got '{results[0]['title']}'."
    )


def test_keyword_and_semantic_disagree(start_app):
    """Sanity invariant: the chosen query must rank different documents first per mode."""
    kw = _search("keyword")[0]["title"]
    sem = _search("semantic")[0]["title"]
    assert kw != sem, (
        f"Keyword and semantic modes must return different top documents for the eval query; "
        f"both returned '{kw}'."
    )


def test_hybrid_alpha_zero_matches_keyword(start_app):
    results = _search("hybrid", alpha=0)
    assert results[0]["title"] == KEYWORD_TOP_TITLE, (
        f"Hybrid mode with alpha=0 must match keyword top '{KEYWORD_TOP_TITLE}', "
        f"got '{results[0]['title']}'."
    )


def test_hybrid_alpha_one_matches_semantic(start_app):
    results = _search("hybrid", alpha=1)
    assert results[0]["title"] == SEMANTIC_TOP_TITLE, (
        f"Hybrid mode with alpha=1 must match semantic top '{SEMANTIC_TOP_TITLE}', "
        f"got '{results[0]['title']}'."
    )


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


def test_search_ui_modes_browser(start_app, browser_verifier):
    reason = (
        "The app serves a knowledge-base search UI that supports Keyword, Semantic, and Hybrid "
        "search modes plus an alpha slider that controls hybrid keyword/vector weighting. Changing "
        "the mode or alpha and re-running the search must deterministically reorder results, with "
        "keyword and semantic modes disagreeing on the top result for the eval query."
    )
    truth = (
        f"Navigate to {APP_URL}. "
        f"Type '{EVAL_QUERY}' into the input element with id 'query-input'. "
        "Set the select element with id 'mode-select' to the value 'keyword' and click the button "
        "with id 'search-button'. Wait for results inside the element with id 'results'. The first "
        f"element with class 'result-item' must contain a 'result-title' reading '{KEYWORD_TOP_TITLE}'. "
        "Next set 'mode-select' to 'semantic' and click 'search-button'; the first result title must "
        f"now read '{SEMANTIC_TOP_TITLE}' (a different document). "
        "Next set 'mode-select' to 'hybrid', set the range slider with id 'alpha-slider' to its "
        "minimum value 0, and click 'search-button'; the first result title must read "
        f"'{KEYWORD_TOP_TITLE}'. "
        "Finally, keep 'hybrid' mode, set 'alpha-slider' to its maximum value 1, and click "
        f"'search-button'; the first result title must read '{SEMANTIC_TOP_TITLE}'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_search_ui_modes_browser",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
