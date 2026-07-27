import os
import shutil
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

# Bind/connect over IPv4 explicitly to avoid IPv6 loopback (::1) resolution issues.
HOST = "127.0.0.1"

APP_PORT = 8080
APP_URL = f"http://{HOST}:{APP_PORT}"

TS_PORT = 8108
TS_URL = f"http://{HOST}:{TS_PORT}"
with open("/etc/typesense-api-key", "r") as f:
    TS_API_KEY = f.read().strip()
TS_DATA_DIR = "/tmp/ts_verify_data"

PROJECT_DIR = "/home/user/leaderboard"
TYPESENSE_BIN = "/usr/local/bin/typesense-server"
COLLECTION = "leaderboard"

# The deterministic seed roster (fresh Typesense data dir guarantees this initial state).
SEED = {
    "p1": ("Alice", 100),
    "p2": ("Bob", 100),
    "p3": ("Carol", 90),
    "p4": ("Dave", 80),
    "p5": ("Eve", 70),
}


# ----------------------------- Fixtures ------------------------------------


@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()


@pytest.fixture(scope="session")
def start_typesense(xprocess):
    # Always start from a clean data directory so the seeded state is deterministic.
    shutil.rmtree(TS_DATA_DIR, ignore_errors=True)
    os.makedirs(TS_DATA_DIR, exist_ok=True)

    class Starter(ProcessStarter):
        name = "typesense_server"
        args = [
            TYPESENSE_BIN,
            f"--data-dir={TS_DATA_DIR}",
            f"--api-key={TS_API_KEY}",
            f"--api-address={HOST}",
            f"--api-port={TS_PORT}",
            "--enable-cors",
        ]
        env = os.environ.copy()
        popen_kwargs = {"cwd": TS_DATA_DIR, "text": True}
        timeout = 120
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, TS_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{TS_URL}/health", timeout=10)
                return resp.status_code == 200 and resp.json().get("ok") is True
            except (requests.RequestException, ValueError):
                return False

    info = xprocess.getinfo(Starter.name)
    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        try:
            with open(info.logpath) as f:
                print("===== Typesense log (%s) =====" % ("started" if started else "FAILED"))
                print(f.read())
        except OSError:
            pass

    yield
    info.terminate()


@pytest.fixture(scope="session")
def start_app(xprocess, start_typesense):
    class Starter(ProcessStarter):
        name = "leaderboard_app"
        args = ["bash", "start.sh"]
        env = os.environ.copy()
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, APP_PORT)) != 0:
                    return False
            try:
                resp = requests.get(f"{APP_URL}/api/leaderboard", timeout=15)
                return resp.status_code == 200
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
                print("===== Leaderboard app log (%s) =====" % ("started" if started else "FAILED"))
                print(f.read())
        except OSError:
            pass

    yield
    info.terminate()


# ----------------------------- Helpers ------------------------------------


def get_leaderboard():
    r = requests.get(f"{APP_URL}/api/leaderboard", timeout=15)
    assert r.status_code == 200, f"GET /api/leaderboard returned {r.status_code}"
    return r.json()


def api_score(pid):
    for row in get_leaderboard():
        if row["player_id"] == pid:
            return int(row["score"])
    raise AssertionError(f"player {pid} not found in /api/leaderboard")


def ts_doc(pid):
    r = requests.get(
        f"{TS_URL}/collections/{COLLECTION}/documents/{pid}",
        headers={"X-TYPESENSE-API-KEY": TS_API_KEY},
        timeout=10,
    )
    return r


def ts_score(pid):
    r = ts_doc(pid)
    assert r.status_code == 200, (
        f"Direct Typesense lookup of document '{pid}' returned {r.status_code}: {r.text}"
    )
    return int(r.json()["score"])


def post_score(pid, delta):
    return requests.post(
        f"{APP_URL}/api/score", json={"player_id": pid, "delta": delta}, timeout=60
    )


def expected_ranking(scores):
    """Independent oracle: rank by score desc, then name asc; sequential 1-based ranks."""
    items = [(pid, SEED[pid][0], scores[pid]) for pid in scores]
    items.sort(key=lambda t: (-t[2], t[1]))
    return [
        {"rank": i + 1, "player_id": pid, "name": name, "score": sc}
        for i, (pid, name, sc) in enumerate(items)
    ]


# ----------------------------- Tests ------------------------------------


def test_initial_leaderboard_api(start_app):
    """Happy path: the seeded ranking with tie-break (Alice before Bob) and 1-based ranks."""
    data = get_leaderboard()
    expected = [
        {"rank": 1, "player_id": "p1", "name": "Alice", "score": 100},
        {"rank": 2, "player_id": "p2", "name": "Bob", "score": 100},
        {"rank": 3, "player_id": "p3", "name": "Carol", "score": 90},
        {"rank": 4, "player_id": "p4", "name": "Dave", "score": 80},
        {"rank": 5, "player_id": "p5", "name": "Eve", "score": 70},
    ]
    normalized = [
        {
            "rank": int(row["rank"]),
            "player_id": row["player_id"],
            "name": row["name"],
            "score": int(row["score"]),
        }
        for row in data
    ]
    assert normalized == expected, (
        f"Initial leaderboard ordering/ranks incorrect.\nExpected: {expected}\nGot: {normalized}"
    )


def test_seed_persisted_in_typesense(start_app):
    """Anti-cheat: the roster is really stored in Typesense (queried directly)."""
    r = requests.get(
        f"{TS_URL}/collections/{COLLECTION}/documents/search",
        params={"q": "*", "query_by": "name", "per_page": 250},
        headers={"X-TYPESENSE-API-KEY": TS_API_KEY},
        timeout=10,
    )
    assert r.status_code == 200, f"Typesense search failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("found") == 5, f"Expected 5 seeded documents, got: {body.get('found')}"
    docs = {h["document"]["id"]: h["document"] for h in body["hits"]}
    for pid, (name, score) in SEED.items():
        assert pid in docs, f"Document '{pid}' missing from Typesense collection."
        assert docs[pid]["name"] == name, f"Document '{pid}' name mismatch."
        assert int(docs[pid]["score"]) == score, f"Document '{pid}' score mismatch."


def test_error_handling(start_app):
    """Negative cases: unknown player -> 404; malformed bodies -> 400. No state mutation."""
    r404 = post_score("does-not-exist", 5)
    assert r404.status_code == 404, (
        f"Updating an unknown player must return 404, got {r404.status_code}"
    )

    r_missing_delta = requests.post(
        f"{APP_URL}/api/score", json={"player_id": "p1"}, timeout=30
    )
    assert r_missing_delta.status_code == 400, (
        f"Missing 'delta' must return 400, got {r_missing_delta.status_code}"
    )

    r_bad_delta = requests.post(
        f"{APP_URL}/api/score", json={"player_id": "p1", "delta": "abc"}, timeout=30
    )
    assert r_bad_delta.status_code == 400, (
        f"Non-integer 'delta' must return 400, got {r_bad_delta.status_code}"
    )

    # Ensure the rejected requests did not mutate p1.
    assert ts_score("p1") == 100, "A rejected update must not change the stored score."


def test_browser_ui_driven_live_update(start_app, browser_verifier):
    """Primary: submitting via the form re-sorts and renumbers the ranking live (no reload)."""
    reason = (
        "The leaderboard web app must render players ranked by score (descending, ties "
        "broken by name ascending) with explicit 1-based rank numbers, and must let a user "
        "submit an additive score update through a form that causes the ranking to re-sort "
        "and renumber live without a full page reload."
    )
    truth = (
        f"Navigate to {APP_URL}/ . A leaderboard container with attribute "
        "data-testid='leaderboard' lists exactly 5 rows. Each row has a data-player-id "
        "attribute and contains descendants with data-testid='rank', data-testid='name' and "
        "data-testid='score'. Confirm the initial rows appear in this order: "
        "rank 1 Alice score 100, rank 2 Bob score 100, rank 3 Carol score 90, "
        "rank 4 Dave score 80, rank 5 Eve score 70. "
        "Then, in the update form, type 'p5' into the input with data-testid='player-id-input', "
        "type '25' into the input with data-testid='delta-input', and click the control with "
        "data-testid='submit-score'. Do NOT reload or refresh the page. Within 10 seconds the "
        "leaderboard must update on its own so that the rows become, in order: "
        "rank 1 Alice score 100, rank 2 Bob score 100, rank 3 Eve score 95, "
        "rank 4 Carol score 90, rank 5 Dave score 80. Verify the rank numbers are the sequential "
        "values 1,2,3,4,5 after the update and that no manual page reload was performed."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_ui_driven_live_update",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"

    # Cross-check the UI-driven update was persisted to Typesense (source of truth).
    assert ts_score("p5") == 95, "UI update to p5 was not persisted to Typesense as score 95."


def test_concurrency_no_lost_updates(start_app):
    """Concurrency: 450 simultaneous additive updates must apply with zero lost updates."""
    c0 = api_score("p3")
    d0 = api_score("p4")

    jobs = [("p3", 1)] * 300 + [("p4", 1)] * 150

    start = time.time()
    with ThreadPoolExecutor(max_workers=64) as pool:
        futures = [pool.submit(post_score, pid, delta) for pid, delta in jobs]
        statuses = [f.result().status_code for f in as_completed(futures)]
    elapsed = time.time() - start

    assert elapsed < 120, f"Concurrent updates took too long ({elapsed:.1f}s) - possible deadlock."
    assert all(s == 200 for s in statuses), (
        f"All concurrent updates must return 200; got statuses: {sorted(set(statuses))}"
    )

    # Exact net invariant, verified both via the app API and directly against Typesense.
    assert api_score("p3") == c0 + 300, "p3 lost updates (API): expected exact net of +300."
    assert api_score("p4") == d0 + 150, "p4 lost updates (API): expected exact net of +150."
    assert ts_score("p3") == c0 + 300, "p3 net not persisted to Typesense (lost updates)."
    assert ts_score("p4") == d0 + 150, "p4 net not persisted to Typesense (lost updates)."


def test_api_ranking_matches_typesense(start_app):
    """Anti-cheat: the derived ranking equals an independent oracle over Typesense state."""
    ts_scores = {pid: ts_score(pid) for pid in SEED}
    expected = expected_ranking(ts_scores)
    actual = [
        {
            "rank": int(row["rank"]),
            "player_id": row["player_id"],
            "name": row["name"],
            "score": int(row["score"]),
        }
        for row in get_leaderboard()
    ]
    assert actual == expected, (
        f"/api/leaderboard ranking does not match Typesense-derived ranking.\n"
        f"Expected: {expected}\nGot: {actual}"
    )


def test_browser_reflects_typesense_final(start_app, browser_verifier):
    """Primary: after concurrent external increments, the browser converges to Typesense state."""
    ts_scores = {pid: ts_score(pid) for pid in SEED}
    ranking = expected_ranking(ts_scores)
    rows_desc = "; ".join(
        f"rank {row['rank']} {row['name']} score {row['score']}" for row in ranking
    )
    reason = (
        "The rendered leaderboard must always reflect the live state stored in the Typesense "
        "backend (not a stale local cache), converging to the correct ranking and scores "
        "without a manual refresh after scores change."
    )
    truth = (
        f"Navigate to {APP_URL}/ and wait up to 15 seconds for the leaderboard to settle. "
        "The leaderboard container (data-testid='leaderboard') must display exactly these 5 rows "
        f"in this exact top-to-bottom order: {rows_desc}. Each row's data-testid='rank' text must "
        "be the sequential numbers 1,2,3,4,5 from top to bottom, and each row's data-testid='score' "
        "text must equal the score listed above for that player. Verify this without performing a "
        "manual page reload."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_reflects_typesense_final",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
