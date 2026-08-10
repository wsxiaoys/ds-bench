import os
import socket

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so a web server listening on 127.0.0.1 would never be
# reached and readiness checks would hang for the full timeout.
HOST = "127.0.0.1"

PROJECT_DIR = "/home/user/catalog-search"
APP_PORT = 3000
BASE_URL = f"http://{HOST}:{APP_PORT}"
SEARCH_URL = f"{BASE_URL}/api/search"

TYPESENSE_BIN = "/usr/local/bin/typesense-server"
TYPESENSE_PORT = 8108
TYPESENSE_HEALTH = f"http://{HOST}:{TYPESENSE_PORT}/health"
TYPESENSE_DATA_DIR = "/home/user/typesense-data"
with open("/etc/typesense-api-key", "r") as f:
    API_KEY = f.read().strip()


def _wait_port(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def services(xprocess):
    """Start the local Typesense server first, then the web application.

    The application indexes the seeded dataset into Typesense on startup, so
    Typesense must be healthy before the app boots.
    """
    os.makedirs(TYPESENSE_DATA_DIR, exist_ok=True)

    class TypesenseStarter(ProcessStarter):
        name = "typesense_server"
        args = [
            TYPESENSE_BIN,
            f"--data-dir={TYPESENSE_DATA_DIR}",
            f"--api-key={API_KEY}",
            f"--listen-address={HOST}",
            f"--listen-port={TYPESENSE_PORT}",
            "--enable-cors",
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": "/home/user", "text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            if not _wait_port(HOST, TYPESENSE_PORT):
                return False
            try:
                resp = requests.get(TYPESENSE_HEALTH, timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except requests.RequestException:
                return False

    class AppStarter(ProcessStarter):
        name = "catalog_app"
        args = ["npm", "start"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            if not _wait_port(HOST, APP_PORT):
                return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    starters = [TypesenseStarter, AppStarter]
    infos = {}
    printed = {}

    def capture_logs(name, tag):
        info = infos[name]
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        start = printed.get(name, 0)
        new_lines = all_lines[start:]
        printed[name] = len(all_lines)
        print(f"===== [{tag}] {name} log (from line {start}) =====")
        print("".join(new_lines))
        print(f"===== [{tag}] {name} log end =====")

    started = []
    try:
        for starter in starters:
            infos[starter.name] = xprocess.getinfo(starter.name)
            xprocess.ensure(starter.name, starter)
            started.append(starter.name)
            capture_logs(starter.name, "STARTED")
        yield
    finally:
        for name in [s.name for s in starters]:
            if name in infos:
                try:
                    capture_logs(name, "TEARDOWN")
                except Exception as exc:  # pragma: no cover - best effort logging
                    print(f"Could not capture logs for {name}: {exc}")
                try:
                    xprocess.getinfo(name).terminate()
                except Exception as exc:  # pragma: no cover - best effort teardown
                    print(f"Could not terminate {name}: {exc}")


def _search(q, lang):
    resp = requests.get(SEARCH_URL, params={"q": q, "lang": lang}, timeout=30)
    assert resp.status_code == 200, (
        f"GET /api/search?q={q!r}&lang={lang!r} returned {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert isinstance(body, dict) and "hits" in body, (
        f"Response for q={q!r}, lang={lang!r} must be an object with a 'hits' key, got: {body!r}"
    )
    hits = body["hits"]
    assert isinstance(hits, list), f"'hits' must be a list, got: {hits!r}"
    return hits


def _ids(hits):
    return [h.get("id") for h in hits]


def _name_for(hits, doc_id):
    for h in hits:
        if h.get("id") == doc_id:
            return h.get("name")
    return None


# --------------------------------------------------------------------------- #
# API checks (secondary)
# --------------------------------------------------------------------------- #

def test_api_english_stemming_and_negative(services):
    """'bake' must match the item whose English name only contains 'Baking',
    and must not match the unrelated 'Ceramic Glazing Class'."""
    hits = _search("bake", "en")
    ids = _ids(hits)
    assert "w1" in ids, f"Expected 'w1' for q='bake' lang='en', got ids: {ids}"
    assert "w2" not in ids, f"'w2' must NOT match q='bake' lang='en', got ids: {ids}"
    assert _name_for(hits, "w1") == "Sourdough Baking Workshop", (
        f"Hit 'w1' name should be the English name, got: {_name_for(hits, 'w1')!r}"
    )


def test_api_english_accent_unaccented_query(services):
    """Unaccented query 'cafe' must match the accented English text 'Café'."""
    hits = _search("cafe", "en")
    ids = _ids(hits)
    assert "w5" in ids, f"Expected 'w5' for q='cafe' lang='en', got ids: {ids}"
    assert _name_for(hits, "w5") == "Vintage Café Signage", (
        f"Hit 'w5' name should be 'Vintage Café Signage', got: {_name_for(hits, 'w5')!r}"
    )


def test_api_english_accent_accented_query(services):
    """Accented query 'naïve' must match the unaccented English text 'Naive'."""
    hits = _search("naïve", "en")
    ids = _ids(hits)
    assert "w6" in ids, f"Expected 'w6' for q='naïve' lang='en', got ids: {ids}"
    assert _name_for(hits, "w6") == "Naive Folk Painting", (
        f"Hit 'w6' name should be 'Naive Folk Painting', got: {_name_for(hits, 'w6')!r}"
    )


def test_api_french_inflection(services):
    """French root query 'finir' must match the conjugated 'finissons'."""
    hits = _search("finir", "fr")
    ids = _ids(hits)
    assert "w3" in ids, f"Expected 'w3' for q='finir' lang='fr', got ids: {ids}"
    assert _name_for(hits, "w3") == "Nous finissons vos sauces", (
        f"Hit 'w3' name should be the French name, got: {_name_for(hits, 'w3')!r}"
    )


def test_api_language_scoping(services):
    """The same French query under English must not return the French item."""
    hits = _search("finir", "en")
    ids = _ids(hits)
    assert "w3" not in ids, (
        f"'w3' must NOT match q='finir' lang='en' (English text has no such word), got ids: {ids}"
    )


def test_api_empty_query_returns_no_hits(services):
    """Empty query must return an empty hits array."""
    hits = _search("", "en")
    assert hits == [], f"Empty query must return no hits, got: {hits}"


# --------------------------------------------------------------------------- #
# Browser checks (primary)
# --------------------------------------------------------------------------- #

def test_browser_english_stemming(services, browser_verifier):
    reason = (
        "The catalog search page must apply English morphological matching so that "
        "a root-form query returns items whose English text only contains an inflected form, "
        "while excluding unrelated items."
    )
    truth = (
        f"Navigate to {BASE_URL}. The page has a language selector with id 'language-select' "
        "(options en, fr, de; en selected by default), a text input with id 'search-input', "
        "and a results list with id 'results'. Ensure the language selector is set to 'en'. "
        "Type 'bake' into the input with id 'search-input'. Wait for the results to load. "
        "Verify that the results list (id 'results') contains a list item with class 'result-item' "
        "and attribute data-doc-id=\"w1\" whose text contains 'Sourdough Baking Workshop'. "
        "Also verify that there is NO element with class 'result-item' and attribute "
        "data-doc-id=\"w2\" in the results."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_english_stemming",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_english_accent_insensitive(services, browser_verifier):
    reason = (
        "English search must be accent-insensitive in both directions: an unaccented query "
        "must match accented text and an accented query must match unaccented text."
    )
    truth = (
        f"Navigate to {BASE_URL}. Ensure the language selector (id 'language-select') is set to 'en'. "
        "Type 'cafe' into the input with id 'search-input' and wait for results. "
        "Verify the results list (id 'results') contains a list item with class 'result-item' and "
        "attribute data-doc-id=\"w5\" whose text contains 'Café'. "
        "Then clear the input and type 'naïve' and wait for results. "
        "Verify the results list contains a list item with class 'result-item' and attribute "
        "data-doc-id=\"w6\" whose text contains 'Naive'."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_english_accent_insensitive",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"


def test_browser_french_inflection_and_language_switch(services, browser_verifier):
    reason = (
        "Switching the selected language must re-scope the query and deterministically change the "
        "result set; French search must match inflected verb forms."
    )
    truth = (
        f"Navigate to {BASE_URL}. Set the language selector (id 'language-select') to 'fr'. "
        "Type 'finir' into the input with id 'search-input' and wait for results. "
        "Verify the results list (id 'results') contains a list item with class 'result-item' and "
        "attribute data-doc-id=\"w3\" whose text contains 'finissons'. "
        "Then, without changing the text in the input, change the language selector (id 'language-select') "
        "to 'en' and wait for the results to reload. "
        "Verify that the results list no longer contains any element with class 'result-item' and "
        "attribute data-doc-id=\"w3\"."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_french_inflection_and_language_switch",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
