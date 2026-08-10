import json
import os
import signal
import socket
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
import requests
from playwright.sync_api import expect, sync_playwright

PROJECT_DIR = "/home/user/polls"
PORT = 4519
# Connect over IPv4 explicitly. On Node 17+ "localhost" can resolve to the IPv6
# loopback (::1); using 127.0.0.1 keeps the readiness check and the tests aligned.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
LOG_PATH = "/logs/app-server.log"

READY_TIMEOUT = 300  # seconds; `npm run start` may build on first launch
LIVE_UPDATE_TIMEOUT_MS = 8000  # requirement is <=5s; extra slack avoids timing flakes


def _port_open() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1.0)
        return s.connect_ex((HOST, PORT)) == 0


class AppServer:
    """Manages the `npm run start` process so tests can also restart it."""

    def __init__(self):
        self.proc = None

    def start(self):
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        env = os.environ.copy()
        env["PORT"] = str(PORT)
        env["HOST"] = HOST
        logfile = open(LOG_PATH, "ab")
        logfile.write(f"\n===== starting `npm run start` at {time.ctime()} =====\n".encode())
        logfile.flush()
        self.proc = subprocess.Popen(
            ["npm", "run", "start"],
            cwd=PROJECT_DIR,
            env=env,
            stdout=logfile,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        self._wait_ready()

    def _wait_ready(self):
        assert self.proc is not None
        deadline = time.time() + READY_TIMEOUT
        while time.time() < deadline:
            if self.proc.poll() is not None:
                self._dump_logs()
                raise RuntimeError(
                    f"`npm run start` exited early with code {self.proc.returncode}."
                )
            if _port_open():
                try:
                    resp = requests.get(BASE_URL, timeout=20)
                    if resp.status_code < 500:
                        return
                except requests.RequestException:
                    pass
            time.sleep(1.0)
        self._dump_logs()
        raise TimeoutError(f"App did not become ready on {BASE_URL} within {READY_TIMEOUT}s.")

    def stop(self):
        if self.proc is None:
            return
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            try:
                self.proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                self.proc.wait(timeout=20)
        except ProcessLookupError:
            pass
        # Wait for the port to be released so a restart can bind it again.
        deadline = time.time() + 30
        while time.time() < deadline and _port_open():
            time.sleep(0.5)
        self.proc = None

    def restart(self):
        self.stop()
        self.start()

    @staticmethod
    def _dump_logs():
        try:
            with open(LOG_PATH, "r") as f:
                print("=============== app-server.log ===============")
                print(f.read())
                print("==============================================")
        except OSError:
            pass


@pytest.fixture(scope="session")
def server():
    srv = AppServer()
    srv.start()
    try:
        yield srv
    finally:
        srv._dump_logs()
        srv.stop()


# --------------------------- API helpers ---------------------------

def create_poll(question, options):
    resp = requests.post(
        f"{BASE_URL}/api/polls",
        json={"question": question, "options": options},
        timeout=30,
    )
    assert resp.status_code == 201, (
        f"POST /api/polls expected 201, got {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert isinstance(data.get("id"), str) and data["id"], "Created poll must have a string id."
    assert data.get("question") == question, "Created poll question mismatch."
    assert data.get("totalVotes") == 0, "New poll totalVotes must be 0."
    assert isinstance(data.get("options"), list) and len(data["options"]) == len(options), (
        "Created poll must echo the same number of options."
    )
    for opt, text in zip(data["options"], options):
        assert opt.get("text") == text, f"Option text mismatch: expected {text}, got {opt}."
        assert opt.get("votes") == 0, "New option votes must be 0."
        assert isinstance(opt.get("id"), str) and opt["id"], "Each option must have a string id."
    return data


def get_poll(poll_id):
    resp = requests.get(f"{BASE_URL}/api/polls/{poll_id}", timeout=30)
    return resp


# --------------------------- API tests ---------------------------

def test_create_and_persist(server):
    poll = create_poll("Best language?", ["Python", "Rust", "Go"])
    resp = get_poll(poll["id"])
    assert resp.status_code == 200, f"GET poll expected 200, got {resp.status_code}."
    fetched = resp.json()
    assert fetched["id"] == poll["id"], "Fetched poll id mismatch."
    assert [o["text"] for o in fetched["options"]] == ["Python", "Rust", "Go"], (
        "Fetched option order/text must match creation order."
    )
    assert fetched["totalVotes"] == 0, "Freshly created poll should have 0 total votes."


def test_create_validation_empty_question(server):
    resp = requests.post(
        f"{BASE_URL}/api/polls",
        json={"question": "", "options": ["a", "b"]},
        timeout=30,
    )
    assert resp.status_code == 400, (
        f"Empty question must be rejected with 400, got {resp.status_code}."
    )


def test_create_validation_single_option(server):
    resp = requests.post(
        f"{BASE_URL}/api/polls",
        json={"question": "Only one", "options": ["a"]},
        timeout=30,
    )
    assert resp.status_code == 400, (
        f"Fewer than 2 options must be rejected with 400, got {resp.status_code}."
    )


def test_get_missing_poll_returns_404(server):
    resp = get_poll("does-not-exist")
    assert resp.status_code == 404, (
        f"Unknown poll id must return 404, got {resp.status_code}."
    )


# --------------------------- Browser tests ---------------------------

def test_live_update_and_double_vote(server):
    poll = create_poll("Pick one", ["Alpha", "Beta", "Gamma"])
    poll_id = poll["id"]
    opt0 = poll["options"][0]["id"]
    opt1 = poll["options"][1]["id"]
    url = f"{BASE_URL}/poll/{poll_id}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx_a = browser.new_context()
        ctx_b = browser.new_context()
        page_a = ctx_a.new_page()
        page_b = ctx_b.new_page()
        page_a.goto(url, wait_until="load")
        page_b.goto(url, wait_until="load")

        # Initial state: both clients see zeros.
        expect(page_a.locator('[data-testid="total-votes"]')).to_contain_text("0", timeout=15000)
        expect(page_b.locator('[data-testid="total-votes"]')).to_contain_text("0", timeout=15000)
        expect(page_b.locator(f'[data-testid="percent-{opt0}"]')).to_contain_text("0%")

        # Vote in context A for the first option.
        page_a.click(f'[data-testid="vote-{opt0}"]')

        # Context B must update live WITHOUT reloading.
        expect(page_b.locator('[data-testid="total-votes"]')).to_contain_text(
            "1", timeout=LIVE_UPDATE_TIMEOUT_MS
        )
        expect(page_b.locator(f'[data-testid="count-{opt0}"]')).to_contain_text(
            "1", timeout=LIVE_UPDATE_TIMEOUT_MS
        )
        expect(page_b.locator(f'[data-testid="percent-{opt0}"]')).to_contain_text(
            "100%", timeout=LIVE_UPDATE_TIMEOUT_MS
        )
        expect(page_b.locator(f'[data-testid="percent-{opt1}"]')).to_contain_text("0%")

        # Double vote attempt in A (same option) is rejected server-side.
        page_a.click(f'[data-testid="vote-{opt0}"]')
        expect(page_a.locator('[data-testid="vote-error"]')).to_be_visible(timeout=LIVE_UPDATE_TIMEOUT_MS)
        expect(page_a.locator('[data-testid="total-votes"]')).to_contain_text("1")

        # Voting a DIFFERENT option from the same client is also rejected (one vote per client).
        page_a.click(f'[data-testid="vote-{opt1}"]')
        expect(page_a.locator('[data-testid="vote-error"]')).to_be_visible(timeout=LIVE_UPDATE_TIMEOUT_MS)
        expect(page_a.locator('[data-testid="total-votes"]')).to_contain_text("1")
        expect(page_a.locator(f'[data-testid="count-{opt1}"]')).to_contain_text("0")

        browser.close()

    # Server-side truth: exactly one vote, only option 0 incremented.
    final = get_poll(poll_id).json()
    assert final["totalVotes"] == 1, (
        f"After one accepted vote and rejected duplicates, totalVotes must be 1, got {final['totalVotes']}."
    )
    votes = {o["id"]: o["votes"] for o in final["options"]}
    assert votes[opt0] == 1, f"Option 0 must have exactly 1 vote, got {votes[opt0]}."
    assert votes[opt1] == 0, f"Option 1 must have 0 votes, got {votes[opt1]}."


def test_concurrent_votes_are_atomic(server):
    poll = create_poll("Concurrent poll", ["Red", "Blue"])
    poll_id = poll["id"]
    opt_ids = [o["id"] for o in poll["options"]]
    total_requests = 50

    def cast(i):
        # No cookie jar per call -> each request is a brand-new client and counts once.
        return requests.post(
            f"{BASE_URL}/api/polls/{poll_id}/vote",
            json={"optionId": opt_ids[i % 2]},
            timeout=30,
        ).status_code

    start = time.time()
    statuses = []
    with ThreadPoolExecutor(max_workers=50) as pool:
        futures = [pool.submit(cast, i) for i in range(total_requests)]
        for fut in as_completed(futures):
            statuses.append(fut.result())
    elapsed = time.time() - start
    assert elapsed < 60, f"50 concurrent votes took too long ({elapsed:.1f}s); possible deadlock."
    assert all(code == 200 for code in statuses), (
        f"Every distinct-client vote should succeed with 200; got statuses {statuses}."
    )

    final = get_poll(poll_id).json()
    assert final["totalVotes"] == total_requests, (
        f"Atomic counting must yield exactly {total_requests} total votes, got {final['totalVotes']}."
    )
    summed = sum(o["votes"] for o in final["options"])
    assert summed == total_requests, (
        f"Sum of option votes must equal {total_requests} (no lost updates), got {summed}."
    )


def test_persistence_across_restart(server):
    poll = create_poll("Persist me?", ["Yes", "No"])
    poll_id = poll["id"]
    opt0 = poll["options"][0]["id"]

    # Vote once as a single client.
    s = requests.Session()
    vote_resp = s.post(
        f"{BASE_URL}/api/polls/{poll_id}/vote",
        json={"optionId": opt0},
        timeout=30,
    )
    assert vote_resp.status_code == 200, (
        f"First vote should succeed with 200, got {vote_resp.status_code}: {vote_resp.text}"
    )

    # Restart the server process; SQLite-on-disk state must survive.
    server.restart()

    resp = get_poll(poll_id)
    assert resp.status_code == 200, "Poll must still exist after a server restart."
    restored = resp.json()
    assert restored["totalVotes"] == 1, (
        f"Vote total must persist across restart, got {restored['totalVotes']}."
    )
    votes = {o["id"]: o["votes"] for o in restored["options"]}
    assert votes[opt0] == 1, "The voted option must still show 1 vote after restart."

    # And the persisted results must render in a fresh browser context.
    url = f"{BASE_URL}/poll/{poll_id}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url, wait_until="load")
        expect(page.locator('[data-testid="total-votes"]')).to_contain_text("1", timeout=15000)
        expect(page.locator(f'[data-testid="percent-{opt0}"]')).to_contain_text("100%")
        browser.close()
