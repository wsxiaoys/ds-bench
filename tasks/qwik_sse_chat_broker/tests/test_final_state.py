import json
import os
import signal
import socket
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
import requests

PROJECT_DIR = "/home/user/qwik-chat"
# Connect over IPv4 explicitly. On Node 17+/Vite, "localhost" may resolve to the
# IPv6 loopback (::1) while the socket check uses AF_INET, causing false timeouts.
HOST = "127.0.0.1"
PORT = 3000
BASE = f"http://{HOST}:{PORT}"
LOG_PATH = "/tmp/qwik_chat_server.log"

START_TIMEOUT = 240
READ_TIMEOUT = 30


def _messages_url(room):
    return f"{BASE}/api/rooms/{room}/messages"


def _stream_url(room):
    return f"{BASE}/api/rooms/{room}/stream"


def _presence_url(room):
    return f"{BASE}/api/rooms/{room}/presence"


class ServerManager:
    """Starts/stops the Qwik City server via `npm start` so we can test restarts."""

    def __init__(self):
        self.proc = None
        self.logfile = None

    def _wait_ready(self, timeout=START_TIMEOUT):
        deadline = time.time() + timeout
        last_err = None
        while time.time() < deadline:
            if self.proc is not None and self.proc.poll() is not None:
                raise RuntimeError(
                    f"Server process exited early with code {self.proc.returncode}. "
                    f"See log at {LOG_PATH}."
                )
            # First check the raw TCP port.
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(2)
                if s.connect_ex((HOST, PORT)) != 0:
                    time.sleep(0.5)
                    continue
            # Then confirm an app route responds (dev servers bundle on demand).
            try:
                resp = requests.get(_presence_url("zealt_ready_probe"), timeout=20)
                if resp.status_code == 200:
                    return
                last_err = f"presence probe returned {resp.status_code}"
            except requests.RequestException as exc:  # noqa: PERF203
                last_err = str(exc)
            time.sleep(0.5)
        raise TimeoutError(
            f"Server did not become ready within {timeout}s. Last error: {last_err}. "
            f"See log at {LOG_PATH}."
        )

    def start(self):
        self.logfile = open(LOG_PATH, "ab")
        self.logfile.write(b"\n===== server start =====\n")
        self.logfile.flush()
        env = os.environ.copy()
        self.proc = subprocess.Popen(
            ["npm", "start"],
            cwd=PROJECT_DIR,
            stdout=self.logfile,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=env,
        )
        self._wait_ready()

    def stop(self):
        if self.proc is None:
            return
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            self.proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
            except ProcessLookupError:
                pass
            self.proc.wait(timeout=10)
        self.proc = None
        if self.logfile is not None:
            self.logfile.flush()
            self.logfile.close()
            self.logfile = None
        # Give the OS a moment to release the port.
        for _ in range(40):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                if s.connect_ex((HOST, PORT)) != 0:
                    return
            time.sleep(0.25)


class SSEClient:
    """Opens an SSE subscription and parses events in a background thread."""

    def __init__(self, room, last_event_id=None):
        headers = {"Accept": "text/event-stream"}
        if last_event_id is not None:
            headers["Last-Event-ID"] = str(last_event_id)
        self.resp = requests.get(
            _stream_url(room),
            headers=headers,
            stream=True,
            timeout=(10, READ_TIMEOUT),
        )
        self.content_type = self.resp.headers.get("Content-Type", "")
        self.status_code = self.resp.status_code
        self.events = []
        self._lock = threading.Lock()
        self._stop = False
        self._thread = threading.Thread(target=self._read, daemon=True)
        self._thread.start()

    def _read(self):
        cur = {}
        try:
            for raw in self.resp.iter_lines(decode_unicode=True):
                if self._stop:
                    break
                if raw is None:
                    continue
                line = raw
                if line == "":
                    if cur:
                        with self._lock:
                            self.events.append(cur)
                        cur = {}
                    continue
                if line.startswith(":"):
                    continue
                if ":" in line:
                    field, _, value = line.partition(":")
                    if value.startswith(" "):
                        value = value[1:]
                else:
                    field, value = line, ""
                if field in ("id", "event"):
                    cur[field] = value
                elif field == "data":
                    cur["data"] = (cur.get("data", "") + value) if "data" in cur else value
        except Exception:
            pass

    def count(self):
        with self._lock:
            return len(self.events)

    def snapshot(self):
        with self._lock:
            return list(self.events)

    def wait_for(self, n, timeout=15):
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.count() >= n:
                return self.snapshot()
            time.sleep(0.05)
        return self.snapshot()

    def close(self):
        self._stop = True
        try:
            self.resp.close()
        except Exception:
            pass


@pytest.fixture(scope="session")
def server():
    mgr = ServerManager()
    mgr.start()
    try:
        yield mgr
    finally:
        mgr.stop()
        if os.path.isfile(LOG_PATH):
            with open(LOG_PATH, "r", errors="replace") as f:
                print("===== server log =====")
                print(f.read())


def post_message(room, payload=None, raw_body=None):
    if raw_body is not None:
        return requests.post(
            _messages_url(room),
            data=raw_body,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
    return requests.post(_messages_url(room), json=payload, timeout=15)


def get_presence(room):
    resp = requests.get(_presence_url(room), timeout=15)
    assert resp.status_code == 200, (
        f"presence for room {room} returned {resp.status_code}, expected 200"
    )
    return resp.json()


def wait_presence(room, expected, timeout=15):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = get_presence(room).get("subscribers")
        if last == expected:
            return
        time.sleep(0.1)
    raise AssertionError(
        f"presence for room {room} did not reach {expected}; last value was {last}"
    )


def seqs_from_events(events):
    result = []
    for ev in events:
        assert "data" in ev, f"SSE event missing data field: {ev}"
        obj = json.loads(ev["data"])
        result.append(obj["seq"])
    return result


# ---------------------------------------------------------------------------
# Test 1: publish response shape (uses room roomA seq 1)
# ---------------------------------------------------------------------------
def test_publish_response_shape(server):
    resp = post_message("roomA", {"user": "alice", "text": "hello"})
    assert resp.status_code == 201, f"expected 201, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert set(body.keys()) == {"room", "seq", "user", "text", "ts"}, (
        f"response must contain exactly keys room,seq,user,text,ts; got {sorted(body.keys())}"
    )
    assert body["room"] == "roomA", f"room should be 'roomA', got {body['room']}"
    assert body["seq"] == 1, f"first message seq must be 1, got {body['seq']}"
    assert body["user"] == "alice", f"user should be 'alice', got {body['user']}"
    assert body["text"] == "hello", f"text should be 'hello', got {body['text']}"
    assert isinstance(body["ts"], int) and body["ts"] > 0, (
        f"ts must be a positive integer, got {body['ts']!r}"
    )


# ---------------------------------------------------------------------------
# Test 2: server overrides client-supplied seq/ts (roomA seq 2)
# ---------------------------------------------------------------------------
def test_server_overrides_seq_and_ts(server):
    resp = post_message("roomA", {"user": "bob", "text": "hi", "seq": 999, "ts": 1})
    assert resp.status_code == 201, f"expected 201, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body["seq"] == 2, (
        f"server must ignore client seq and assign 2, got {body['seq']}"
    )
    assert body["ts"] != 1, "server must overwrite client-supplied ts=1"
    assert isinstance(body["ts"], int) and body["ts"] > 1_000_000_000_000, (
        f"ts must be a server epoch-ms timestamp, got {body['ts']!r}"
    )


# ---------------------------------------------------------------------------
# Test 3: validation -> 400, and rejected requests consume no sequence
# ---------------------------------------------------------------------------
def test_validation_and_no_sequence_consumption(server):
    cases = [
        {"user": "", "text": "x"},
        {"text": "no user"},
        {"user": "u", "text": ""},
        {"user": "u", "text": "a" * 2001},
    ]
    for payload in cases:
        resp = post_message("roomA", payload)
        assert resp.status_code == 400, (
            f"invalid payload {payload} must return 400, got {resp.status_code}: {resp.text}"
        )
        body = resp.json()
        assert "error" in body, f"400 response must include an 'error' key; got {body}"

    # malformed JSON
    resp = post_message("roomA", raw_body="{ this is not valid json ")
    assert resp.status_code == 400, (
        f"malformed JSON body must return 400, got {resp.status_code}: {resp.text}"
    )

    # A subsequent valid message must get seq 3 (proving no rejected request consumed a seq).
    resp = post_message("roomA", {"user": "carol", "text": "third"})
    assert resp.status_code == 201, f"expected 201, got {resp.status_code}: {resp.text}"
    assert resp.json()["seq"] == 3, (
        f"rejected requests must not consume the per-room sequence; expected seq 3, "
        f"got {resp.json()['seq']}"
    )


# ---------------------------------------------------------------------------
# Test 4: history replay window (last 50) and SSE framing
# ---------------------------------------------------------------------------
def test_history_replay_window_and_framing(server):
    room = "hist"
    for i in range(1, 61):
        resp = post_message(room, {"user": "u", "text": f"m{i}"})
        assert resp.status_code == 201, f"post m{i} failed: {resp.status_code} {resp.text}"
        assert resp.json()["seq"] == i, f"expected seq {i}, got {resp.json()['seq']}"

    client = SSEClient(room)
    try:
        assert "text/event-stream" in client.content_type, (
            f"stream response Content-Type must be text/event-stream, got {client.content_type!r}"
        )
        events = client.wait_for(50, timeout=20)
        assert len(events) == 50, (
            f"default replay must send the last 50 messages, got {len(events)}"
        )
        seqs = seqs_from_events(events)
        assert seqs == list(range(11, 61)), (
            f"replay must be seq 11..60 ascending, got {seqs}"
        )
        for ev in events:
            obj = json.loads(ev["data"])
            assert ev.get("event") == "message", (
                f"each event must have 'event: message', got {ev.get('event')!r}"
            )
            assert ev.get("id") == str(obj["seq"]), (
                f"SSE id must equal the message seq; id={ev.get('id')!r} seq={obj['seq']}"
            )
            assert obj["room"] == room, f"data.room must be {room}, got {obj['room']}"
            assert obj["text"] == f"m{obj['seq']}", (
                f"data.text mismatch for seq {obj['seq']}: {obj['text']}"
            )
            assert set(obj.keys()) == {"room", "seq", "user", "text", "ts"}, (
                f"data JSON must contain exactly room,seq,user,text,ts; got {sorted(obj.keys())}"
            )
    finally:
        client.close()


# ---------------------------------------------------------------------------
# Test 5: live streaming, ordering & room isolation
# ---------------------------------------------------------------------------
def test_live_streaming_ordering_and_isolation(server):
    c1 = SSEClient("iso1")
    c2 = SSEClient("iso2")
    try:
        wait_presence("iso1", 1)
        wait_presence("iso2", 1)

        for i in range(1, 4):
            resp = post_message("iso1", {"user": "u", "text": f"a{i}"})
            assert resp.status_code == 201, f"post to iso1 failed: {resp.text}"

        got1 = c1.wait_for(3, timeout=15)
        assert seqs_from_events(got1)[:3] == [1, 2, 3], (
            f"iso1 subscriber must receive seq 1,2,3 in order, got {seqs_from_events(got1)}"
        )
        time.sleep(1.0)
        assert c2.count() == 0, (
            f"iso2 subscriber must NOT receive iso1 messages, got {seqs_from_events(c2.snapshot())}"
        )

        for i in range(1, 3):
            resp = post_message("iso2", {"user": "u", "text": f"b{i}"})
            assert resp.status_code == 201, f"post to iso2 failed: {resp.text}"

        got2 = c2.wait_for(2, timeout=15)
        assert seqs_from_events(got2)[:2] == [1, 2], (
            f"iso2 subscriber must receive its own seq 1,2, got {seqs_from_events(got2)}"
        )
        time.sleep(1.0)
        assert c1.count() == 3, (
            f"iso1 subscriber must not receive iso2 messages; iso1 events "
            f"{seqs_from_events(c1.snapshot())}"
        )
    finally:
        c1.close()
        c2.close()


# ---------------------------------------------------------------------------
# Test 6: Last-Event-ID resume (no gaps / no dupes)
# ---------------------------------------------------------------------------
def test_last_event_id_resume(server):
    room = "resume"
    for _ in range(3):
        assert post_message(room, {"user": "u", "text": "x"}).status_code == 201

    first = SSEClient(room)
    try:
        got = first.wait_for(3, timeout=15)
        assert seqs_from_events(got) == [1, 2, 3], (
            f"initial connect must replay seq 1,2,3, got {seqs_from_events(got)}"
        )
    finally:
        first.close()

    # posted while disconnected
    for _ in range(2):
        assert post_message(room, {"user": "u", "text": "y"}).status_code == 201

    resumed = SSEClient(room, last_event_id=3)
    try:
        got = resumed.wait_for(2, timeout=15)
        assert seqs_from_events(got) == [4, 5], (
            f"resume from Last-Event-ID:3 must yield exactly seq 4,5 (no gaps/dupes), "
            f"got {seqs_from_events(got)}"
        )
        wait_presence(room, 1)
        assert post_message(room, {"user": "u", "text": "z"}).status_code == 201
        got = resumed.wait_for(3, timeout=15)
        assert seqs_from_events(got) == [4, 5, 6], (
            f"resumed connection must continue live with seq 6, got {seqs_from_events(got)}"
        )
    finally:
        resumed.close()


# ---------------------------------------------------------------------------
# Test 7: presence counts increment/decrement
# ---------------------------------------------------------------------------
def test_presence_counts(server):
    room = "pres"
    assert get_presence(room)["subscribers"] == 0, "fresh room presence must be 0"

    c1 = SSEClient(room)
    try:
        wait_presence(room, 1)
        c2 = SSEClient(room)
        try:
            wait_presence(room, 2)
            c1.close()
            wait_presence(room, 1)
        finally:
            c2.close()
        wait_presence(room, 0)
    finally:
        c1.close()


# ---------------------------------------------------------------------------
# Test 8: concurrent publish -> atomic, gapless sequence 1..50
# ---------------------------------------------------------------------------
def test_concurrent_publish_atomic_sequence(server):
    room = "conc"
    n = 50

    def do_post(i):
        r = post_message(room, {"user": "u", "text": f"c{i}"})
        assert r.status_code == 201, f"concurrent post {i} failed: {r.status_code} {r.text}"
        return r.json()["seq"]

    start = time.time()
    with ThreadPoolExecutor(max_workers=n) as ex:
        seqs = list(ex.map(do_post, range(n)))
    elapsed = time.time() - start
    assert elapsed < 60, f"concurrent publishing took too long ({elapsed:.1f}s) - possible deadlock"

    assert sorted(seqs) == list(range(1, n + 1)), (
        f"concurrent posts must yield exactly seq 1..{n} with no gaps/dupes, got {sorted(seqs)}"
    )

    client = SSEClient(room)
    try:
        events = client.wait_for(n, timeout=20)
        replay_seqs = seqs_from_events(events)
        assert replay_seqs == list(range(1, n + 1)), (
            f"replay must contain seq 1..{n} ascending exactly once, got {replay_seqs}"
        )
    finally:
        client.close()


# ---------------------------------------------------------------------------
# Test 9: durability across a full server restart (runs last)
# ---------------------------------------------------------------------------
def test_durability_across_restart(server):
    room = "durab"
    assert post_message(room, {"user": "u", "text": "d1"}).json()["seq"] == 1
    assert post_message(room, {"user": "u", "text": "d2"}).json()["seq"] == 2

    server.stop()
    server.start()

    client = SSEClient(room)
    try:
        events = client.wait_for(2, timeout=20)
        replay_seqs = seqs_from_events(events)
        assert 1 in replay_seqs and 2 in replay_seqs, (
            f"after restart, replay must include persisted seq 1 and 2, got {replay_seqs}"
        )
    finally:
        client.close()

    resp = post_message(room, {"user": "u", "text": "d3"})
    assert resp.status_code == 201, f"post after restart failed: {resp.text}"
    assert resp.json()["seq"] == 3, (
        f"sequence must continue from persisted state after restart (expected 3), "
        f"got {resp.json()['seq']}"
    )
