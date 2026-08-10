import os
import socket
import threading
import queue
import time
import json
import concurrent.futures

import pytest
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/qwik-notepad"
PORT = 3000
# Connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the IPv6
# loopback (::1); using 127.0.0.1 avoids readiness checks hanging on a mismatch.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
DOC_URL = f"{BASE_URL}/api/doc"
SUBSCRIBERS_URL = f"{BASE_URL}/api/subscribers"


# --------------------------------------------------------------------------- #
# SSE client helper (raw HTTP, robust SSE framing parser)
# --------------------------------------------------------------------------- #
class SSEClient:
    """Opens a streaming HTTP connection and parses Server-Sent Events.

    Parses raw bytes (not requests.iter_lines, which is known to drop the blank
    lines that delimit SSE events). Exposes parsed `update`-style events and
    comment (heartbeat) lines through thread-safe queues.
    """

    def __init__(self, url):
        self.resp = requests.get(
            url,
            stream=True,
            headers={"Accept": "text/event-stream"},
            timeout=(10, 30),
        )
        self.events = queue.Queue()
        self.comments = queue.Queue()
        self._stop = False
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        buf = b""
        event_name = None
        data_lines = []
        last_id = None
        try:
            for chunk in self.resp.iter_content(chunk_size=64):
                if self._stop:
                    break
                if not chunk:
                    continue
                buf += chunk
                while b"\n" in buf:
                    raw, buf = buf.split(b"\n", 1)
                    line = raw.rstrip(b"\r").decode("utf-8", errors="replace")
                    if line == "":
                        # blank line -> dispatch buffered event
                        if data_lines or event_name is not None or last_id is not None:
                            self.events.put(
                                {
                                    "event": event_name,
                                    "data": "\n".join(data_lines),
                                    "id": last_id,
                                }
                            )
                        event_name = None
                        data_lines = []
                        last_id = None
                        continue
                    if line.startswith(":"):
                        self.comments.put(line)
                        continue
                    if ":" in line:
                        field, _, value = line.partition(":")
                        if value.startswith(" "):
                            value = value[1:]
                    else:
                        field, value = line, ""
                    if field == "event":
                        event_name = value
                    elif field == "data":
                        data_lines.append(value)
                    elif field == "id":
                        last_id = value
        except Exception:
            pass

    def next_event(self, timeout: float = 10):
        return self.events.get(timeout=timeout)

    def wait_for_comment(self, timeout: float = 4.0):
        try:
            return self.comments.get(timeout=timeout)
        except queue.Empty:
            return None

    def close(self):
        self._stop = True
        try:
            self.resp.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def _int_id(event):
    assert event["id"] is not None, f"SSE event missing id field: {event}"
    return int(event["id"])


def get_snapshot():
    """Open a fresh SSE connection, read the immediate snapshot, close."""
    with SSEClient(DOC_URL) as c:
        ev = c.next_event(timeout=10)
        assert ev["event"] == "update", f"first SSE event must be 'update', got {ev}"
        return _int_id(ev), ev["data"]


def poll_subscriber_count(expected, timeout=8.0):
    """Poll the subscriber count until it equals `expected` or times out."""
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = requests.get(SUBSCRIBERS_URL, timeout=10)
        assert r.status_code == 200, f"/api/subscribers returned {r.status_code}"
        last = r.json().get("count")
        if last == expected:
            return last
        time.sleep(0.3)
    return last


# --------------------------------------------------------------------------- #
# Long-running app fixture
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "qwik_notepad"
        args = ["npm", "start"]
        env = {**os.environ, "PORT": str(PORT), "HOST": HOST}
        popen_kwargs = {"cwd": PROJECT_DIR, "text": True}
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
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
        except FileNotFoundError:
            lines = []
        new = lines[printed:]
        printed = len(lines)
        print(f"===== [{tag}] {Starter.name} log =====")
        print("".join(new))
        print(f"===== [{tag}] end log =====")

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
def browser_verifier():
    return PochiVerifier()


# --------------------------------------------------------------------------- #
# A. SSE snapshot + framing + heartbeat
# --------------------------------------------------------------------------- #
def test_sse_snapshot_content_type_and_heartbeat(start_app):
    with SSEClient(DOC_URL) as c:
        assert c.resp.status_code == 200, (
            f"GET /api/doc must return 200, got {c.resp.status_code}"
        )
        ctype = c.resp.headers.get("Content-Type", "")
        assert "text/event-stream" in ctype, (
            f"GET /api/doc Content-Type must be text/event-stream, got '{ctype}'"
        )
        ev = c.next_event(timeout=10)
        assert ev["event"] == "update", (
            f"Initial SSE message must be event 'update', got {ev}"
        )
        v0 = _int_id(ev)
        assert v0 >= 0, f"Snapshot version must be a non-negative integer, got {v0}"
        # Heartbeat: at least one SSE comment line within ~3.5s of an idle stream.
        comment = c.wait_for_comment(timeout=3.5)
        assert comment is not None and comment.startswith(":"), (
            "Expected at least one SSE heartbeat comment line (starting with ':') "
            "within ~3.5s on an idle stream."
        )


# --------------------------------------------------------------------------- #
# B. Edit broadcast with correct, server-assigned version (anti-cheat)
# --------------------------------------------------------------------------- #
def test_edit_broadcast_and_version_is_server_assigned(start_app):
    with SSEClient(DOC_URL) as c:
        snap = c.next_event(timeout=10)
        v0 = _int_id(snap)

        resp = requests.post(
            DOC_URL, json={"text": "hello world", "version": 999999}, timeout=10
        )
        assert resp.status_code == 200, (
            f"POST /api/doc must return 200, got {resp.status_code}"
        )
        body = resp.json()
        assert body.get("version") == v0 + 1, (
            f"Server must assign version {v0 + 1} (ignoring client-supplied 999999), "
            f"got {body.get('version')}"
        )
        assert body.get("version") != 999999, (
            "Server must NOT trust the client-supplied version 999999."
        )
        assert body.get("text") == "hello world", (
            f"POST response text must echo 'hello world', got {body.get('text')}"
        )

        # The open stream must receive the broadcast for this edit.
        deadline = time.time() + 10
        received = None
        while time.time() < deadline:
            ev = c.next_event(timeout=10)
            if _int_id(ev) == v0 + 1:
                received = ev
                break
        assert received is not None, (
            f"Open SSE stream did not receive an update with id {v0 + 1}."
        )
        assert received["event"] == "update", "Broadcast must be an 'update' event."
        assert received["data"] == "hello world", (
            f"Broadcast data must be 'hello world', got {received['data']!r}"
        )


# --------------------------------------------------------------------------- #
# C. Fan-out to multiple subscribers
# --------------------------------------------------------------------------- #
def test_fanout_to_multiple_subscribers(start_app):
    with SSEClient(DOC_URL) as a, SSEClient(DOC_URL) as b:
        va = _int_id(a.next_event(timeout=10))
        vb = _int_id(b.next_event(timeout=10))
        base = max(va, vb)

        resp = requests.post(DOC_URL, json={"text": "multi tab sync"}, timeout=10)
        assert resp.status_code == 200, "POST for fan-out test must return 200."
        target = resp.json()["version"]
        assert target >= base + 1, (
            f"Version after posting must advance past both snapshots ({base}), got {target}"
        )

        for name, client in (("A", a), ("B", b)):
            deadline = time.time() + 10
            got = None
            while time.time() < deadline:
                ev = client.next_event(timeout=10)
                if _int_id(ev) == target:
                    got = ev
                    break
            assert got is not None, (
                f"Subscriber {name} did not receive the broadcast with id {target}."
            )
            assert got["data"] == "multi tab sync", (
                f"Subscriber {name} received wrong data: {got['data']!r}"
            )


# --------------------------------------------------------------------------- #
# D. Multi-line SSE framing (boundary)
# --------------------------------------------------------------------------- #
def test_multiline_text_sse_framing(start_app):
    text = "line1\nline2\nline3"
    with SSEClient(DOC_URL) as c:
        vc = _int_id(c.next_event(timeout=10))

        resp = requests.post(DOC_URL, json={"text": text}, timeout=10)
        assert resp.status_code == 200, "POST with multi-line text must return 200."
        body = resp.json()
        assert body["version"] == vc + 1, (
            f"Version must advance to {vc + 1}, got {body['version']}"
        )
        assert body["text"] == text, (
            f"POST response must preserve multi-line text exactly, got {body['text']!r}"
        )

        deadline = time.time() + 10
        got = None
        while time.time() < deadline:
            ev = c.next_event(timeout=10)
            if _int_id(ev) == vc + 1:
                got = ev
                break
        assert got is not None, f"Did not receive multi-line broadcast id {vc + 1}."
        assert got["data"] == text, (
            "Multi-line text must be reconstructed exactly from multiple data: lines, "
            f"got {got['data']!r}"
        )


# --------------------------------------------------------------------------- #
# E. Validation / no side effects on bad input
# --------------------------------------------------------------------------- #
def test_invalid_edits_rejected_with_no_side_effects(start_app):
    v_before, text_before = get_snapshot()

    r1 = requests.post(DOC_URL, json={"foo": "bar"}, timeout=10)
    assert r1.status_code == 400, (
        f"POST without 'text' must return 400, got {r1.status_code}"
    )
    assert "error" in r1.json(), "400 response must include an 'error' field."

    r2 = requests.post(DOC_URL, json={"text": 123}, timeout=10)
    assert r2.status_code == 400, (
        f"POST with non-string 'text' must return 400, got {r2.status_code}"
    )
    assert "error" in r2.json(), "400 response must include an 'error' field."

    v_after, text_after = get_snapshot()
    assert v_after == v_before, (
        f"Rejected edits must NOT advance the version ({v_before} -> {v_after})."
    )
    assert text_after == text_before, (
        "Rejected edits must NOT change the stored document text."
    )


# --------------------------------------------------------------------------- #
# F. Concurrency — gapless, unique versions (last-write-wins)
# --------------------------------------------------------------------------- #
def test_concurrent_edits_gapless_versions(start_app):
    v_before, _ = get_snapshot()
    n = 25
    texts = [f"edit-{i}" for i in range(n)]

    def do_post(t):
        r = requests.post(DOC_URL, json={"text": t}, timeout=20)
        return r.status_code, r.json()

    start = time.time()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=n) as ex:
        futures = [ex.submit(do_post, t) for t in texts]
        for f in concurrent.futures.as_completed(futures, timeout=60):
            results.append(f.result())
    elapsed = time.time() - start
    assert elapsed < 40, f"Concurrent edits took too long ({elapsed:.1f}s) — possible deadlock."

    statuses = [s for s, _ in results]
    assert all(s == 200 for s in statuses), f"All concurrent edits must return 200, got {statuses}"

    versions = sorted(body["version"] for _, body in results)
    expected = list(range(v_before + 1, v_before + n + 1))
    assert versions == expected, (
        f"Concurrent edits must produce unique, gapless versions {expected[0]}..{expected[-1]}, "
        f"got {versions}"
    )

    # Last-write-wins: final snapshot version equals the highest assigned version,
    # and its text equals the text of the edit that was assigned that version.
    version_to_text = {body["version"]: body["text"] for _, body in results}
    top = v_before + n
    v_final, text_final = get_snapshot()
    assert v_final == top, f"Final snapshot version must be {top}, got {v_final}"
    assert text_final == version_to_text[top], (
        f"Final document text must be the text assigned version {top} "
        f"({version_to_text[top]!r}), got {text_final!r}"
    )


# --------------------------------------------------------------------------- #
# G. Subscriber lifecycle / cleanup
# --------------------------------------------------------------------------- #
def test_subscriber_count_tracks_connect_and_disconnect(start_app):
    r0 = requests.get(SUBSCRIBERS_URL, timeout=10)
    assert r0.status_code == 200, "/api/subscribers must return 200."
    c0 = r0.json()["count"]
    assert isinstance(c0, int), "/api/subscribers count must be an integer."

    client = SSEClient(DOC_URL)
    try:
        client.next_event(timeout=10)  # ensure connection established
        count_connected = poll_subscriber_count(c0 + 1, timeout=8)
        assert count_connected == c0 + 1, (
            f"Subscriber count must rise to {c0 + 1} while connected, got {count_connected}"
        )
    finally:
        client.close()

    count_after = poll_subscriber_count(c0, timeout=10)
    assert count_after == c0, (
        f"Subscriber count must return to {c0} after disconnect, got {count_after}"
    )


# --------------------------------------------------------------------------- #
# H. Browser client: multi-tab live sync + connection status
# --------------------------------------------------------------------------- #
def test_browser_multitab_sync(start_app, browser_verifier):
    reason = (
        "The home page is a collaborative notepad that connects to a Server-Sent "
        "Events stream after becoming visible, shows a live connection status, and "
        "keeps multiple browser tabs in sync in real time."
    )
    truth = (
        f"Open a browser tab to {BASE_URL}/ . Verify a text area with attribute "
        "data-testid=\"editor\" is present, an element with data-testid=\"version\" "
        "is present, and an element with data-testid=\"status\" is present and its "
        "text becomes exactly 'connected'. Then open a SECOND browser tab to "
        f"{BASE_URL}/ and wait for its status to read 'connected'. Switch to the "
        "first tab and type the text 'synced text' into the data-testid=\"editor\" "
        "text area. Then switch to the second tab and verify that within a few "
        "seconds its data-testid=\"editor\" text area value becomes 'synced text' "
        "and its data-testid=\"version\" element shows a number greater than 0. "
        "This confirms real-time cross-tab synchronization over SSE."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_browser_multitab_sync",
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
