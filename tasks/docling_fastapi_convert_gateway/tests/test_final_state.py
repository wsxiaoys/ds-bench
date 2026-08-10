import hashlib
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from datetime import datetime

import pytest
import requests

PROJECT_DIR = "/home/user/project"
SERVICE_ENTRYPOINT = os.path.join(PROJECT_DIR, "service", "main.py")
ASSETS_DIR = os.path.join(PROJECT_DIR, "assets")
STATE_DIR = os.path.join(PROJECT_DIR, "state")

HANDBOOK = os.path.join(ASSETS_DIR, "safety_handbook.html")
RELEASE_NOTES = os.path.join(ASSETS_DIR, "release_notes.md")
CORRUPT_INPUT = os.path.join(ASSETS_DIR, "corrupt_input.xyz")

HOST = "127.0.0.1"
PORT = 8077
BASE_URL = f"http://{HOST}:{PORT}"

TERMINAL_STATES = {"succeeded", "failed", "cancelled"}
ALL_STATES = {"queued", "running", "succeeded", "failed", "cancelled"}
JOB_KEYS = {
    "job_id",
    "seq",
    "state",
    "source_kind",
    "source_name",
    "fingerprint",
    "pace_seconds",
    "progress",
    "created_at",
    "started_at",
    "finished_at",
    "duration_seconds",
    "cancel_requested",
    "error",
}
UNKNOWN_JOB_ID = "00000000-0000-4000-8000-0000000ffff0"

# Values shared between tests (populated by the fixtures/tests that create them).
SHARED = {}


# --------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------
def sha256_of(path):
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def port_is_open():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex((HOST, PORT)) == 0


def wait_port_free(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not port_is_open():
            return True
        time.sleep(0.5)
    return False


def parse_rfc3339_utc(value, label):
    assert isinstance(value, str) and value.endswith("Z"), (
        f"{label} must be an RFC 3339 UTC timestamp string ending in 'Z', got {value!r}."
    )
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AssertionError(f"{label} is not a parsable RFC 3339 timestamp: {value!r} ({exc})")


def assert_job_shape(job):
    assert isinstance(job, dict), f"Job payload must be a JSON object, got: {job!r}"
    assert set(job.keys()) == JOB_KEYS, (
        f"Job object keys must be exactly {sorted(JOB_KEYS)}, got {sorted(job.keys())}."
    )
    assert isinstance(job["job_id"], str) and len(job["job_id"]) >= 32, (
        f"job_id must be a canonical UUID string, got {job['job_id']!r}."
    )
    assert isinstance(job["seq"], int) and not isinstance(job["seq"], bool) and job["seq"] >= 1, (
        f"seq must be an integer >= 1, got {job['seq']!r}."
    )
    assert job["state"] in ALL_STATES, f"Unexpected job state {job['state']!r}."
    assert job["source_kind"] in {"upload", "path"}, (
        f"source_kind must be 'upload' or 'path', got {job['source_kind']!r}."
    )
    assert isinstance(job["source_name"], str) and job["source_name"], (
        "source_name must be a non-empty string."
    )
    assert isinstance(job["fingerprint"], str) and len(job["fingerprint"]) == 64, (
        f"fingerprint must be a sha256 hex digest, got {job['fingerprint']!r}."
    )
    assert isinstance(job["pace_seconds"], (int, float)) and not isinstance(
        job["pace_seconds"], bool
    ), f"pace_seconds must be numeric, got {job['pace_seconds']!r}."
    progress = job["progress"]
    assert isinstance(progress, (int, float)) and not isinstance(progress, bool), (
        f"progress must be numeric, got {progress!r}."
    )
    assert 0.0 <= float(progress) <= 1.0, f"progress must be within [0.0, 1.0], got {progress!r}."
    assert round(float(progress), 2) == float(progress), (
        f"progress must be rounded to 2 decimals, got {progress!r}."
    )
    parse_rfc3339_utc(job["created_at"], "created_at")
    for key in ("started_at", "finished_at"):
        if job[key] is not None:
            parse_rfc3339_utc(job[key], key)
    if job["duration_seconds"] is not None:
        assert isinstance(job["duration_seconds"], (int, float)) and not isinstance(
            job["duration_seconds"], bool
        ), f"duration_seconds must be numeric or null, got {job['duration_seconds']!r}."
        assert float(job["duration_seconds"]) >= 0, "duration_seconds must not be negative."
    assert isinstance(job["cancel_requested"], bool), "cancel_requested must be a boolean."
    if job["error"] is not None:
        assert isinstance(job["error"], dict), f"error must be null or an object, got {job['error']!r}."
        assert set(job["error"].keys()) == {"code", "message"}, (
            f"error object must have exactly the keys 'code' and 'message', got {sorted(job['error'].keys())}."
        )
        assert isinstance(job["error"]["message"], str) and job["error"]["message"].strip(), (
            "error.message must be a non-empty string."
        )
    if job["state"] == "queued":
        assert float(progress) == 0.0, "A queued job must report progress 0.0."
    if job["state"] == "running":
        assert 0.0 < float(progress) < 1.0, (
            f"A running job must report progress strictly between 0.0 and 1.0, got {progress!r}."
        )
    if job["state"] == "succeeded":
        assert float(progress) == 1.0, "A succeeded job must report progress 1.0."
        assert job["error"] is None, "A succeeded job must have error null."


def assert_error_envelope(response, expected_status, expected_code):
    assert response.status_code == expected_status, (
        f"Expected HTTP {expected_status} with code {expected_code}, "
        f"got HTTP {response.status_code}: {response.text[:400]}"
    )
    content_type = response.headers.get("Content-Type", "")
    assert content_type.startswith("application/json"), (
        f"Error responses must be application/json, got {content_type!r}."
    )
    payload = response.json()
    assert isinstance(payload, dict) and set(payload.keys()) == {"error"}, (
        f"Error body must be exactly {{'error': ...}}, got {payload!r}."
    )
    error = payload["error"]
    assert isinstance(error, dict) and set(error.keys()) == {"code", "message"}, (
        f"Error object must have exactly the keys 'code' and 'message', got {error!r}."
    )
    assert error["code"] == expected_code, (
        f"Expected error code {expected_code!r}, got {error['code']!r}."
    )
    assert isinstance(error["message"], str) and error["message"].strip(), (
        "Error message must be a non-empty string."
    )
    return error


def submit_upload(path, pace_seconds=None, idempotency_key=None, filename=None, timeout=30):
    with open(path, "rb") as handle:
        payload = handle.read()
    files = {"file": (filename or os.path.basename(path), payload, "application/octet-stream")}
    data = {}
    if pace_seconds is not None:
        data["pace_seconds"] = str(pace_seconds)
    headers = {}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return requests.post(
        f"{BASE_URL}/v1/jobs/upload", files=files, data=data, headers=headers, timeout=timeout
    )


def submit_path(source_path, pace_seconds=None, idempotency_key=None, body=None, timeout=30):
    if body is None:
        body = {"source_path": source_path}
        if pace_seconds is not None:
            body["pace_seconds"] = pace_seconds
    headers = {}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return requests.post(f"{BASE_URL}/v1/jobs/path", json=body, headers=headers, timeout=timeout)


def get_job(job_id, timeout=15):
    return requests.get(f"{BASE_URL}/v1/jobs/{job_id}", timeout=timeout)


def wait_for_terminal(job_id, timeout=180):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        response = get_job(job_id)
        assert response.status_code == 200, (
            f"GET /v1/jobs/{job_id} returned HTTP {response.status_code}: {response.text[:300]}"
        )
        last = response.json()
        assert_job_shape(last)
        if last["state"] in TERMINAL_STATES:
            return last
        time.sleep(0.3)
    raise AssertionError(
        f"Job {job_id} did not reach a terminal state within {timeout}s; last seen: {last!r}"
    )


def wait_for_state(job_id, states, timeout=60):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        response = get_job(job_id)
        assert response.status_code == 200, (
            f"GET /v1/jobs/{job_id} returned HTTP {response.status_code}: {response.text[:300]}"
        )
        last = response.json()
        if last["state"] in states:
            return last
        time.sleep(0.2)
    raise AssertionError(
        f"Job {job_id} never reached one of {sorted(states)} within {timeout}s; last seen: {last!r}"
    )


def health():
    response = requests.get(f"{BASE_URL}/healthz", timeout=10)
    assert response.status_code == 200, (
        f"GET /healthz returned HTTP {response.status_code}: {response.text[:300]}"
    )
    return response.json()


def metrics():
    response = requests.get(f"{BASE_URL}/metrics", timeout=10)
    assert response.status_code == 200, (
        f"GET /metrics returned HTTP {response.status_code}: {response.text[:300]}"
    )
    return response.json()


def wait_until_idle(timeout=90):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = health()
        if last.get("running") == 0 and last.get("queue_depth") == 0:
            return last
        time.sleep(0.5)
    raise AssertionError(f"Gateway never became idle within {timeout}s; last /healthz: {last!r}")


def cancel(job_id, timeout=15):
    return requests.post(f"{BASE_URL}/v1/jobs/{job_id}/cancel", timeout=timeout)


def drain(job_ids):
    for job_id in job_ids:
        try:
            cancel(job_id)
        except requests.RequestException:
            pass
    for job_id in job_ids:
        try:
            wait_for_terminal(job_id, timeout=90)
        except AssertionError:
            pass


def fetch_result(job_id, fmt=None, timeout=60):
    params = {} if fmt is None else {"format": fmt}
    return requests.get(f"{BASE_URL}/v1/jobs/{job_id}/result", params=params, timeout=timeout)


class GatewayProcess:
    """Starts/stops the executor's gateway exactly the way the task specifies."""

    def __init__(self):
        self.proc = None
        self.log_path = "/tmp/gateway_service.log"
        self._log_handle = None
        self._printed_lines = 0

    def start(self, extra_env=None, ready_timeout=60):
        assert self.proc is None, "The gateway process is already running."
        assert wait_port_free(20), f"TCP port {PORT} is still in use; cannot start the gateway."
        env = os.environ.copy()
        env["GATEWAY_PORT"] = str(PORT)
        env["GATEWAY_STATE_DIR"] = STATE_DIR
        env.pop("GATEWAY_JOB_TIMEOUT_SECONDS", None)
        if extra_env:
            env.update(extra_env)
        self._log_handle = open(self.log_path, "a", encoding="utf-8")
        self.proc = subprocess.Popen(
            [sys.executable, "service/main.py"],
            cwd=PROJECT_DIR,
            env=env,
            stdout=self._log_handle,
            stderr=subprocess.STDOUT,
        )
        deadline = time.time() + ready_timeout
        while time.time() < deadline:
            if self.proc.poll() is not None:
                code = self.proc.returncode
                self.proc = None
                self.dump_logs("STARTUP-CRASHED")
                raise AssertionError(
                    f"'python service/main.py' exited with code {code} during startup."
                )
            try:
                response = requests.get(f"{BASE_URL}/healthz", timeout=3)
                if response.status_code == 200:
                    self.dump_logs("STARTED")
                    return
            except requests.RequestException:
                pass
            time.sleep(0.5)
        self.dump_logs("STARTUP-TIMEOUT")
        raise AssertionError(
            f"The gateway did not answer GET {BASE_URL}/healthz with HTTP 200 within {ready_timeout}s."
        )

    def stop(self, grace=10):
        """SIGTERM the gateway; returns True when it exited within the grace period."""
        if self.proc is None:
            return True
        graceful = True
        self.proc.send_signal(signal.SIGTERM)
        try:
            self.proc.wait(timeout=grace)
        except subprocess.TimeoutExpired:
            graceful = False
            self.proc.kill()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
        self.proc = None
        if self._log_handle is not None:
            self._log_handle.flush()
            self._log_handle.close()
            self._log_handle = None
        self.dump_logs("STOPPED")
        wait_port_free(15)
        return graceful

    def dump_logs(self, tag):
        if not os.path.exists(self.log_path):
            return
        with open(self.log_path, "r", encoding="utf-8", errors="replace") as handle:
            lines = handle.readlines()
        new_lines = lines[self._printed_lines :]
        self._printed_lines = len(lines)
        print(f"=============== [{tag}] gateway log ===============")
        print("".join(new_lines[-200:]))
        print(f"=============== [{tag}] end gateway log ===========")


@pytest.fixture(scope="session")
def gateway():
    subprocess.run(["pkill", "-f", "service/main.py"], capture_output=True)
    wait_port_free(20)
    shutil.rmtree(STATE_DIR, ignore_errors=True)
    process = GatewayProcess()
    process.start()
    yield process
    process.stop()


@pytest.fixture(scope="session")
def handbook_job(gateway):
    """A finished conversion of assets/safety_handbook.html, reused by several tests."""
    response = submit_upload(HANDBOOK)
    assert response.status_code == 201, (
        f"Uploading safety_handbook.html must return HTTP 201, got {response.status_code}: "
        f"{response.text[:400]}"
    )
    created = response.json()
    assert_job_shape(created)
    final = wait_for_terminal(created["job_id"], timeout=240)
    assert final["state"] == "succeeded", (
        f"Converting safety_handbook.html must succeed, got state {final['state']!r} "
        f"with error {final['error']!r}."
    )
    SHARED["handbook_job_id"] = final["job_id"]
    return {"created": created, "final": final}


# --------------------------------------------------------------------------------------
# tests
# --------------------------------------------------------------------------------------
def test_service_entrypoint_and_health_contract(gateway):
    assert os.path.isfile(SERVICE_ENTRYPOINT), (
        f"The gateway entrypoint {SERVICE_ENTRYPOINT} does not exist."
    )
    payload = health()
    assert set(payload.keys()) == {
        "status",
        "workers",
        "queue_capacity",
        "queue_depth",
        "running",
        "uptime_seconds",
    }, f"/healthz must return exactly the documented keys, got {sorted(payload.keys())}."
    assert payload["status"] == "ok", f"/healthz status must be 'ok', got {payload['status']!r}."
    assert payload["workers"] == 2, f"/healthz workers must be 2, got {payload['workers']!r}."
    assert payload["queue_capacity"] == 4, (
        f"/healthz queue_capacity must be 4, got {payload['queue_capacity']!r}."
    )
    assert isinstance(payload["queue_depth"], int) and not isinstance(payload["queue_depth"], bool)
    assert isinstance(payload["running"], int) and not isinstance(payload["running"], bool)
    assert isinstance(payload["uptime_seconds"], (int, float)) and payload["uptime_seconds"] >= 0, (
        f"/healthz uptime_seconds must be a non-negative number, got {payload['uptime_seconds']!r}."
    )


def test_upload_submission_and_state_machine(gateway, handbook_job):
    created = handbook_job["created"]
    final = handbook_job["final"]
    assert created["state"] in {"queued", "running"}, (
        f"A freshly accepted job must start as queued or running, got {created['state']!r}."
    )
    assert created["source_kind"] == "upload", "An uploaded job must have source_kind 'upload'."
    assert created["source_name"] == "safety_handbook.html", (
        f"source_name must be the uploaded file name, got {created['source_name']!r}."
    )
    assert created["fingerprint"] == sha256_of(HANDBOOK), (
        "fingerprint must be the lowercase sha256 hex digest of the submitted document bytes."
    )
    assert created["error"] is None, "A freshly accepted job must have error null."
    assert created["cancel_requested"] is False, (
        "A freshly accepted job must have cancel_requested false."
    )
    assert final["progress"] == 1.0, "A succeeded job must report progress 1.0."
    assert final["started_at"] is not None, "A succeeded job must have a non-null started_at."
    assert final["finished_at"] is not None, "A succeeded job must have a non-null finished_at."
    assert final["duration_seconds"] is not None, (
        "A succeeded job must expose a numeric duration_seconds."
    )
    started = parse_rfc3339_utc(final["started_at"], "started_at")
    finished = parse_rfc3339_utc(final["finished_at"], "finished_at")
    created_at = parse_rfc3339_utc(final["created_at"], "created_at")
    assert created_at <= started <= finished, (
        "Timestamps must satisfy created_at <= started_at <= finished_at, got "
        f"{final['created_at']} / {final['started_at']} / {final['finished_at']}."
    )
    expected_duration = (finished - started).total_seconds()
    assert abs(float(final["duration_seconds"]) - expected_duration) <= 1.0, (
        f"duration_seconds ({final['duration_seconds']}) must match finished_at - started_at "
        f"({expected_duration:.3f})."
    )


def test_result_markdown_representation(gateway, handbook_job):
    job_id = handbook_job["final"]["job_id"]
    response = fetch_result(job_id, "markdown")
    assert response.status_code == 200, (
        f"Markdown result must return HTTP 200, got {response.status_code}: {response.text[:300]}"
    )
    assert response.headers.get("Content-Type", "").startswith("text/markdown"), (
        f"Markdown result Content-Type must start with 'text/markdown', got "
        f"{response.headers.get('Content-Type')!r}."
    )
    assert response.headers.get("X-Job-Id") == job_id, (
        f"Result responses must carry X-Job-Id: {job_id}, got {response.headers.get('X-Job-Id')!r}."
    )
    body = response.text
    for marker in ("Field Safety Handbook", "Incident Response"):
        assert marker in body, (
            f"The Markdown conversion of safety_handbook.html must contain {marker!r}. Got:\n{body[:800]}"
        )
    default_response = fetch_result(job_id)
    assert default_response.status_code == 200, (
        "Omitting the format query parameter must default to markdown and return HTTP 200."
    )
    assert default_response.text == body, (
        "The default result format must be identical to format=markdown."
    )
    SHARED["handbook_markdown"] = body


def test_result_document_json_representation(gateway, handbook_job):
    job_id = handbook_job["final"]["job_id"]
    response = fetch_result(job_id, "json")
    assert response.status_code == 200, (
        f"JSON result must return HTTP 200, got {response.status_code}: {response.text[:300]}"
    )
    assert response.headers.get("Content-Type", "").startswith("application/json"), (
        "The json result must be served as application/json."
    )
    assert response.headers.get("X-Job-Id") == job_id, "Result responses must carry X-Job-Id."
    payload = response.json()
    assert set(payload.keys()) == {"job_id", "format", "document"}, (
        f"The json result body must have exactly the keys job_id, format, document; got {sorted(payload.keys())}."
    )
    assert payload["job_id"] == job_id and payload["format"] == "json", (
        "The json result body must echo the job id and the format 'json'."
    )
    document = payload["document"]
    assert isinstance(document, dict), "The 'document' value must be a JSON object."
    assert "texts" in document, (
        f"The structured document must contain a 'texts' collection; got keys {sorted(document.keys())[:20]}."
    )
    assert isinstance(document["texts"], list) and len(document["texts"]) >= 1, (
        "The converted handbook must yield a non-empty 'texts' collection."
    )
    SHARED["handbook_document"] = document


def test_result_chunks_representation(gateway, handbook_job):
    job_id = handbook_job["final"]["job_id"]
    response = fetch_result(job_id, "chunks")
    assert response.status_code == 200, (
        f"Chunks result must return HTTP 200, got {response.status_code}: {response.text[:300]}"
    )
    assert response.headers.get("X-Job-Id") == job_id, "Result responses must carry X-Job-Id."
    payload = response.json()
    assert set(payload.keys()) == {"job_id", "format", "count", "chunks"}, (
        f"The chunks body must have exactly the keys job_id, format, count, chunks; got {sorted(payload.keys())}."
    )
    assert payload["job_id"] == job_id and payload["format"] == "chunks", (
        "The chunks body must echo the job id and the format 'chunks'."
    )
    chunks = payload["chunks"]
    assert isinstance(chunks, list) and len(chunks) >= 1, "The handbook must produce at least one chunk."
    assert payload["count"] == len(chunks), (
        f"count ({payload['count']}) must equal the number of returned chunks ({len(chunks)})."
    )
    markdown = SHARED.get("handbook_markdown")
    if markdown is None:
        markdown = fetch_result(job_id, "markdown").text
    headings_seen = 0
    for position, chunk in enumerate(chunks):
        assert set(chunk.keys()) == {"index", "text", "headings", "char_len"}, (
            f"Chunk {position} must have exactly the keys index, text, headings, char_len; got {sorted(chunk.keys())}."
        )
        assert chunk["index"] == position, (
            f"Chunk indices must start at 0 and ascend contiguously; chunk at position {position} has index {chunk['index']}."
        )
        assert isinstance(chunk["text"], str) and chunk["text"].strip(), (
            f"Chunk {position} must carry a non-empty text."
        )
        assert chunk["char_len"] == len(chunk["text"]), (
            f"Chunk {position} char_len ({chunk['char_len']}) must equal len(text) ({len(chunk['text'])})."
        )
        assert isinstance(chunk["headings"], list), f"Chunk {position} headings must be a list."
        for heading in chunk["headings"]:
            assert isinstance(heading, str) and heading.strip(), (
                f"Chunk {position} headings must contain non-empty strings, got {heading!r}."
            )
            assert heading in markdown, (
                f"Chunk heading {heading!r} does not appear in the Markdown representation, so the "
                "chunks are not derived from the converted document structure."
            )
        if chunk["headings"]:
            headings_seen += 1
    assert headings_seen >= 1, (
        "At least one chunk of the sectioned handbook must carry a non-empty heading trail; "
        "raw text slicing is not acceptable."
    )
    SHARED["handbook_chunks"] = chunks


def test_result_error_cases(gateway, handbook_job):
    job_id = handbook_job["final"]["job_id"]
    assert_error_envelope(fetch_result(job_id, "doctags"), 400, "INVALID_FORMAT")
    assert_error_envelope(fetch_result(UNKNOWN_JOB_ID, "markdown"), 404, "JOB_NOT_FOUND")
    assert_error_envelope(get_job(UNKNOWN_JOB_ID), 404, "JOB_NOT_FOUND")


def test_path_submission_success(gateway):
    response = submit_path(RELEASE_NOTES)
    assert response.status_code == 201, (
        f"A valid path submission must return HTTP 201, got {response.status_code}: {response.text[:300]}"
    )
    job = response.json()
    assert_job_shape(job)
    assert job["source_kind"] == "path", "A path submission must have source_kind 'path'."
    assert job["source_name"] == "release_notes.md", (
        f"source_name must be the base file name, got {job['source_name']!r}."
    )
    assert job["fingerprint"] == sha256_of(RELEASE_NOTES), (
        "fingerprint must be the sha256 hex digest of the referenced document bytes."
    )
    final = wait_for_terminal(job["job_id"], timeout=180)
    assert final["state"] == "succeeded", (
        f"Converting release_notes.md must succeed, got {final['state']!r} / {final['error']!r}."
    )
    markdown = fetch_result(final["job_id"], "markdown")
    assert markdown.status_code == 200, "The markdown result of the path job must be available."
    assert "Release Notes 4.2" in markdown.text, (
        f"The markdown conversion of release_notes.md must contain 'Release Notes 4.2'. Got:\n{markdown.text[:600]}"
    )
    SHARED["release_notes_job_id"] = final["job_id"]


def test_path_submission_rejections(gateway):
    before = metrics()["submitted"]
    assert_error_envelope(submit_path("/etc/hostname"), 403, "PATH_NOT_ALLOWED")
    assert_error_envelope(
        submit_path("/home/user/project/assets/../../../etc/hostname"), 403, "PATH_NOT_ALLOWED"
    )
    assert_error_envelope(
        submit_path(os.path.join(ASSETS_DIR, "does_not_exist.html")), 404, "SOURCE_NOT_FOUND"
    )
    assert_error_envelope(submit_path(None, body={}), 400, "VALIDATION_ERROR")
    assert_error_envelope(submit_path(None, body={"source_path": "   "}), 400, "VALIDATION_ERROR")
    assert_error_envelope(submit_path(RELEASE_NOTES, pace_seconds=99), 400, "VALIDATION_ERROR")
    assert_error_envelope(submit_path(RELEASE_NOTES, pace_seconds=-1), 400, "VALIDATION_ERROR")
    after = metrics()["submitted"]
    assert after == before, (
        f"Rejected submissions must not create jobs, but 'submitted' moved from {before} to {after}."
    )


def test_upload_validation_errors(gateway):
    before = metrics()["submitted"]
    no_file = requests.post(
        f"{BASE_URL}/v1/jobs/upload",
        files={"notfile": ("x.txt", b"hello", "text/plain")},
        timeout=30,
    )
    assert_error_envelope(no_file, 400, "VALIDATION_ERROR")
    assert_error_envelope(submit_upload(RELEASE_NOTES, pace_seconds="abc"), 400, "VALIDATION_ERROR")
    assert_error_envelope(submit_upload(RELEASE_NOTES, pace_seconds=31), 400, "VALIDATION_ERROR")
    after = metrics()["submitted"]
    assert after == before, (
        f"Rejected uploads must not create jobs, but 'submitted' moved from {before} to {after}."
    )


def test_idempotency_replay_and_conflict(gateway):
    key = "zealt-key-a"
    submitted_before = metrics()["submitted"]
    first = submit_upload(RELEASE_NOTES, idempotency_key=key)
    assert first.status_code == 201, (
        f"The first submission with a fresh Idempotency-Key must return 201, got {first.status_code}: "
        f"{first.text[:300]}"
    )
    first_job = first.json()
    assert_job_shape(first_job)
    hits_before = metrics()["idempotent_hits"]
    submitted_mid = metrics()["submitted"]
    assert submitted_mid == submitted_before + 1, (
        "Accepting one new job must increase 'submitted' by exactly 1."
    )

    replay = submit_upload(RELEASE_NOTES, idempotency_key=key)
    assert replay.status_code == 200, (
        f"Replaying a known Idempotency-Key must return HTTP 200, got {replay.status_code}: {replay.text[:300]}"
    )
    replay_job = replay.json()
    assert_job_shape(replay_job)
    assert replay_job["job_id"] == first_job["job_id"], (
        "An idempotent replay must return the original job id."
    )
    assert replay_job["seq"] == first_job["seq"], "An idempotent replay must return the original seq."
    assert replay_job["created_at"] == first_job["created_at"], (
        "An idempotent replay must return the original created_at (no new conversion)."
    )
    after = metrics()
    assert after["submitted"] == submitted_mid, (
        f"An idempotent replay must not increase 'submitted' ({submitted_mid} -> {after['submitted']})."
    )
    assert after["idempotent_hits"] == hits_before + 1, (
        f"An idempotent replay must increase 'idempotent_hits' ({hits_before} -> {after['idempotent_hits']})."
    )

    jobs_before = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 100}, timeout=15).json()["count"]
    assert_error_envelope(
        submit_upload(HANDBOOK, idempotency_key=key), 409, "IDEMPOTENCY_KEY_CONFLICT"
    )
    jobs_after = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 100}, timeout=15).json()["count"]
    assert jobs_after == jobs_before, (
        "A conflicting idempotency replay must not create a job "
        f"({jobs_before} -> {jobs_after} jobs listed)."
    )
    SHARED["idempotent_job_id"] = first_job["job_id"]
    wait_for_terminal(first_job["job_id"], timeout=180)


def test_submissions_without_key_are_always_distinct(gateway):
    first = submit_path(RELEASE_NOTES)
    second = submit_path(RELEASE_NOTES)
    assert first.status_code == 201 and second.status_code == 201, (
        "Two keyless submissions of identical content must both be accepted with HTTP 201."
    )
    first_job, second_job = first.json(), second.json()
    assert first_job["job_id"] != second_job["job_id"], (
        "Submissions without an Idempotency-Key must always create distinct jobs."
    )
    assert second_job["seq"] > first_job["seq"], "seq must increase with each accepted job."
    assert first_job["fingerprint"] == second_job["fingerprint"], (
        "Identical content must produce identical fingerprints."
    )
    for job in (first_job, second_job):
        wait_for_terminal(job["job_id"], timeout=180)


def test_queue_backpressure_and_responsiveness(gateway):
    wait_until_idle()
    key = "zealt-key-saturated"
    job_ids = []
    try:
        for index in range(6):
            response = submit_upload(
                HANDBOOK, pace_seconds=20, idempotency_key=key if index == 0 else None
            )
            assert response.status_code == 201, (
                f"Submission {index + 1} of 6 must be accepted with HTTP 201, got "
                f"{response.status_code}: {response.text[:300]}"
            )
            job_ids.append(response.json()["job_id"])

        deadline = time.time() + 30
        snapshot = None
        while time.time() < deadline:
            snapshot = health()
            if snapshot["running"] == 2 and snapshot["queue_depth"] == 4:
                break
            time.sleep(0.3)
        assert snapshot is not None and snapshot["running"] == 2 and snapshot["queue_depth"] == 4, (
            "With 6 paced jobs submitted, exactly 2 must run and 4 must wait in the queue; "
            f"/healthz reported {snapshot!r}."
        )

        rejected_before = metrics()["rejected_queue_full"]
        overflow = submit_upload(HANDBOOK, pace_seconds=20)
        assert_error_envelope(overflow, 429, "QUEUE_FULL")
        retry_after = overflow.headers.get("Retry-After")
        assert retry_after is not None, "A 429 QUEUE_FULL response must carry a Retry-After header."
        assert retry_after.strip().isdigit() and int(retry_after) >= 1, (
            f"Retry-After must be an integer number of seconds >= 1, got {retry_after!r}."
        )
        assert metrics()["rejected_queue_full"] == rejected_before + 1, (
            "A queue-full rejection must increase the 'rejected_queue_full' metric by 1."
        )

        started = time.time()
        snapshot = health()
        elapsed = time.time() - started
        assert elapsed < 1.0, (
            f"/healthz must answer in under 1 second while both workers are busy, took {elapsed:.2f}s."
        )
        assert snapshot["running"] == 2 and snapshot["queue_depth"] == 4, (
            f"/healthz must still report the saturated state, got {snapshot!r}."
        )

        replay = submit_upload(HANDBOOK, pace_seconds=20, idempotency_key=key)
        assert replay.status_code == 200, (
            "An idempotent replay of a known key must still succeed with HTTP 200 while the queue is full, "
            f"got {replay.status_code}: {replay.text[:300]}"
        )
        assert replay.json()["job_id"] == job_ids[0], (
            "The idempotent replay must return the original job id even under backpressure."
        )
    finally:
        drain(job_ids)
        wait_until_idle()


def test_queue_is_fifo(gateway):
    wait_until_idle()
    job_ids = []
    try:
        for _ in range(4):
            response = submit_upload(HANDBOOK, pace_seconds=4)
            assert response.status_code == 201, (
                f"FIFO setup submission failed with HTTP {response.status_code}: {response.text[:300]}"
            )
            job_ids.append(response.json()["job_id"])
        finals = [wait_for_terminal(job_id, timeout=240) for job_id in job_ids]
        for job in finals:
            assert job["state"] == "succeeded", (
                f"FIFO setup jobs must succeed, got {job['state']!r} / {job['error']!r}."
            )
            assert job["started_at"] is not None, "Every executed job must record started_at."
        ordered = sorted(finals, key=lambda job: job["seq"])
        starts = [parse_rfc3339_utc(job["started_at"], "started_at") for job in ordered]
        for earlier, later in zip(starts, starts[1:]):
            assert earlier <= later, (
                "Queued jobs must start in ascending seq order (FIFO); observed start times "
                f"{[job['started_at'] for job in ordered]}."
            )
        assert starts[-1] > starts[0], (
            "With only 2 workers and 4 paced jobs, the last job must start after the first one."
        )
    finally:
        drain(job_ids)


def test_cancel_queued_job_never_runs(gateway):
    wait_until_idle()
    job_ids = []
    try:
        for _ in range(2):
            response = submit_upload(HANDBOOK, pace_seconds=25)
            assert response.status_code == 201
            job_ids.append(response.json()["job_id"])
        deadline = time.time() + 30
        while time.time() < deadline and health()["running"] < 2:
            time.sleep(0.2)
        victim_response = submit_upload(HANDBOOK, pace_seconds=25)
        assert victim_response.status_code == 201
        victim = victim_response.json()["job_id"]
        job_ids.append(victim)
        queued = wait_for_state(victim, {"queued"}, timeout=15)
        assert queued["state"] == "queued", "The third paced job must be waiting in the queue."

        pending_result = fetch_result(victim, "markdown")
        assert_error_envelope(pending_result, 409, "JOB_NOT_FINISHED")

        response = cancel(victim)
        assert response.status_code == 200, (
            f"Cancelling a queued job must return HTTP 200, got {response.status_code}: {response.text[:300]}"
        )
        job = response.json()
        assert_job_shape(job)
        assert job["state"] == "cancelled", (
            f"A cancelled queued job must immediately be in state 'cancelled', got {job['state']!r}."
        )
        assert job["started_at"] is None, "A job cancelled while queued must never have started."
        assert job["finished_at"] is not None, "A cancelled job must record finished_at."

        time.sleep(3)
        refreshed = get_job(victim).json()
        assert refreshed["state"] == "cancelled" and refreshed["started_at"] is None, (
            f"A job cancelled while queued must never run afterwards, got {refreshed!r}."
        )
        assert_error_envelope(fetch_result(victim, "markdown"), 409, "RESULT_UNAVAILABLE")
    finally:
        drain(job_ids)
        wait_until_idle()


def test_cancel_running_job_during_pacing(gateway):
    wait_until_idle()
    response = submit_upload(HANDBOOK, pace_seconds=25)
    assert response.status_code == 201
    job_id = response.json()["job_id"]
    try:
        running = wait_for_state(job_id, {"running"}, timeout=30)
        assert running["state"] == "running"
        assert 0.0 < float(running["progress"]) < 1.0, (
            f"A running job must report progress strictly between 0 and 1, got {running['progress']!r}."
        )
        cancel_response = cancel(job_id)
        assert cancel_response.status_code == 202, (
            f"Cancelling a running job must return HTTP 202, got {cancel_response.status_code}: "
            f"{cancel_response.text[:300]}"
        )
        body = cancel_response.json()
        assert_job_shape(body)
        assert body["cancel_requested"] is True, (
            "The 202 cancel response must report cancel_requested true."
        )
        deadline = time.time() + 15
        final = None
        while time.time() < deadline:
            final = get_job(job_id).json()
            if final["state"] in TERMINAL_STATES:
                break
            time.sleep(0.2)
        assert final is not None and final["state"] in TERMINAL_STATES, (
            f"A cancelled running job must become terminal within 15 seconds, got {final!r}."
        )
        assert final["state"] == "cancelled", (
            "A job cancelled inside its pacing window must end in state 'cancelled', got "
            f"{final['state']!r}."
        )
        assert final["cancel_requested"] is True, "cancel_requested must remain true."
        assert final["finished_at"] is not None, "A cancelled job must record finished_at."
        assert_error_envelope(fetch_result(job_id, "chunks"), 409, "RESULT_UNAVAILABLE")
    finally:
        drain([job_id])
        wait_until_idle()


def test_cancel_terminal_and_unknown_jobs(gateway, handbook_job):
    job_id = handbook_job["final"]["job_id"]
    assert_error_envelope(cancel(job_id), 409, "JOB_ALREADY_TERMINAL")
    assert_error_envelope(cancel(UNKNOWN_JOB_ID), 404, "JOB_NOT_FOUND")
    refreshed = get_job(job_id).json()
    assert refreshed["state"] == "succeeded", (
        "A rejected cancellation must not change the job state."
    )


def test_event_stream_contract(gateway):
    wait_until_idle()
    response = submit_upload(HANDBOOK, pace_seconds=6)
    assert response.status_code == 201
    job_id = response.json()["job_id"]
    lines = []
    try:
        opened = time.time()
        stream = requests.get(
            f"{BASE_URL}/v1/jobs/{job_id}/events", stream=True, timeout=(10, 45)
        )
        assert stream.status_code == 200, (
            f"The event stream must return HTTP 200, got {stream.status_code}: {stream.text[:300]}"
        )
        content_type = stream.headers.get("Content-Type", "")
        assert content_type.startswith("application/x-ndjson"), (
            f"The event stream Content-Type must start with 'application/x-ndjson', got {content_type!r}."
        )
        first_line_delay = None
        hard_deadline = time.time() + 120
        for raw in stream.iter_lines(decode_unicode=True):
            if time.time() > hard_deadline:
                raise AssertionError("The event stream did not terminate within 120 seconds.")
            if raw is None or not raw.strip():
                continue
            if first_line_delay is None:
                first_line_delay = time.time() - opened
            lines.append(json.loads(raw))
            if lines[-1]["state"] in TERMINAL_STATES:
                break
        stream.close()

        assert lines, "The event stream produced no events."
        assert first_line_delay is not None and first_line_delay < 3.0, (
            f"The first event must arrive within 2 seconds (streamed, not buffered), took {first_line_delay:.2f}s."
        )
        previous_progress = -1.0
        for position, event in enumerate(lines):
            assert set(event.keys()) == {"seq", "job_id", "state", "progress", "ts"}, (
                f"Event {position} must have exactly the keys seq, job_id, state, progress, ts; got {sorted(event.keys())}."
            )
            assert event["seq"] == position, (
                f"Event seq must start at 0 and increment by 1; event at position {position} has seq {event['seq']}."
            )
            assert event["job_id"] == job_id, "Every event must carry the streamed job id."
            assert event["state"] in ALL_STATES, f"Unexpected event state {event['state']!r}."
            progress = float(event["progress"])
            assert 0.0 <= progress <= 1.0, f"Event progress must be within [0,1], got {progress}."
            assert progress >= previous_progress, (
                f"Event progress must never decrease: {previous_progress} -> {progress}."
            )
            previous_progress = progress
            parse_rfc3339_utc(event["ts"], "event ts")
        assert lines[-1]["state"] in TERMINAL_STATES, (
            f"The stream must end right after a terminal-state event, last event: {lines[-1]!r}."
        )
        assert lines[-1]["state"] == "succeeded", (
            f"The streamed job must succeed, ended as {lines[-1]['state']!r}."
        )
        assert float(lines[-1]["progress"]) == 1.0, (
            "The terminal event of a succeeded job must report progress 1.0."
        )
        assert len(lines) >= 2, (
            "A job that was queued/running when the stream opened must emit more than one event."
        )
    finally:
        drain([job_id])


def test_event_stream_for_terminal_and_unknown_jobs(gateway, handbook_job):
    job_id = handbook_job["final"]["job_id"]
    stream = requests.get(f"{BASE_URL}/v1/jobs/{job_id}/events", stream=True, timeout=(10, 30))
    assert stream.status_code == 200, (
        f"The event stream of a finished job must return HTTP 200, got {stream.status_code}."
    )
    events = []
    for raw in stream.iter_lines(decode_unicode=True):
        if raw is None or not raw.strip():
            continue
        events.append(json.loads(raw))
        if len(events) > 3:
            break
    stream.close()
    assert len(events) == 1, (
        f"An already-terminal job must yield exactly one event and then close, got {len(events)}: {events!r}"
    )
    assert events[0]["seq"] == 0 and events[0]["state"] == "succeeded", (
        f"The single event must have seq 0 and the terminal state, got {events[0]!r}."
    )
    assert_error_envelope(
        requests.get(f"{BASE_URL}/v1/jobs/{UNKNOWN_JOB_ID}/events", timeout=15),
        404,
        "JOB_NOT_FOUND",
    )


def test_conversion_failure_is_a_job_level_error(gateway):
    response = submit_upload(CORRUPT_INPUT)
    assert response.status_code == 201, (
        "An unconvertible document must still be accepted with HTTP 201, got "
        f"{response.status_code}: {response.text[:300]}"
    )
    job_id = response.json()["job_id"]
    final = wait_for_terminal(job_id, timeout=180)
    assert final["state"] == "failed", (
        f"Converting corrupt_input.xyz must end as 'failed', got {final['state']!r}."
    )
    assert final["error"] is not None and final["error"]["code"] == "CONVERSION_FAILED", (
        f"A failed conversion must report error code CONVERSION_FAILED, got {final['error']!r}."
    )
    assert final["error"]["message"].strip(), "The failure message must not be empty."
    assert final["finished_at"] is not None, "A failed job must record finished_at."
    assert 0.0 <= float(final["progress"]) <= 1.0, "progress must stay within [0,1]."
    for fmt in ("markdown", "json", "chunks"):
        assert_error_envelope(fetch_result(job_id, fmt), 409, "RESULT_UNAVAILABLE")
    SHARED["failed_job_id"] = job_id


def test_job_listing(gateway, handbook_job):
    response = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 100}, timeout=15)
    assert response.status_code == 200, (
        f"GET /v1/jobs must return HTTP 200, got {response.status_code}: {response.text[:300]}"
    )
    payload = response.json()
    assert set(payload.keys()) == {"count", "jobs"}, (
        f"The listing body must have exactly the keys count and jobs, got {sorted(payload.keys())}."
    )
    jobs = payload["jobs"]
    assert payload["count"] == len(jobs), (
        f"count ({payload['count']}) must equal the number of returned jobs ({len(jobs)})."
    )
    assert len(jobs) >= 3, "Several jobs were submitted, so the listing must not be empty."
    for job in jobs:
        assert_job_shape(job)
    seqs = [job["seq"] for job in jobs]
    assert seqs == sorted(seqs, reverse=True) and len(set(seqs)) == len(seqs), (
        f"Jobs must be listed by seq strictly descending, got {seqs}."
    )
    assert handbook_job["final"]["job_id"] in {job["job_id"] for job in jobs}, (
        "The finished handbook job must appear in the job listing."
    )

    limited = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 2}, timeout=15).json()
    assert limited["count"] == 2 and len(limited["jobs"]) == 2, (
        f"limit=2 must return exactly 2 jobs, got {limited['count']}."
    )
    assert [job["seq"] for job in limited["jobs"]] == seqs[:2], (
        f"limit=2 must return the two highest seq values {seqs[:2]}, got {[j['seq'] for j in limited['jobs']]}."
    )

    succeeded = requests.get(
        f"{BASE_URL}/v1/jobs", params={"state": "succeeded", "limit": 100}, timeout=15
    ).json()
    assert succeeded["jobs"], "There must be at least one succeeded job."
    assert all(job["state"] == "succeeded" for job in succeeded["jobs"]), (
        "state=succeeded must only return succeeded jobs."
    )
    failed = requests.get(
        f"{BASE_URL}/v1/jobs", params={"state": "failed", "limit": 100}, timeout=15
    ).json()
    assert all(job["state"] == "failed" for job in failed["jobs"]), (
        "state=failed must only return failed jobs."
    )
    assert SHARED.get("failed_job_id") in {job["job_id"] for job in failed["jobs"]}, (
        "The corrupt-document job must be listed under state=failed."
    )

    for params in ({"state": "bogus"}, {"limit": "0"}, {"limit": "abc"}, {"limit": "101"}):
        assert_error_envelope(
            requests.get(f"{BASE_URL}/v1/jobs", params=params, timeout=15), 400, "VALIDATION_ERROR"
        )


def test_metrics_are_consistent_with_listings(gateway):
    wait_until_idle()
    payload = metrics()
    expected_keys = {
        "submitted",
        "succeeded",
        "failed",
        "cancelled",
        "rejected_queue_full",
        "idempotent_hits",
        "queued_now",
        "running_now",
    }
    assert set(payload.keys()) == expected_keys, (
        f"/metrics must expose exactly {sorted(expected_keys)}, got {sorted(payload.keys())}."
    )
    for key, value in payload.items():
        assert isinstance(value, int) and not isinstance(value, bool), (
            f"/metrics value for {key!r} must be an integer, got {value!r}."
        )
    listing = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 100}, timeout=15).json()["jobs"]
    for state in ("succeeded", "failed", "cancelled"):
        counted = sum(1 for job in listing if job["state"] == state)
        assert payload[state] == counted, (
            f"/metrics {state} ({payload[state]}) must match the number of {state} jobs in the listing ({counted})."
        )
    assert payload["submitted"] >= len(listing), (
        f"'submitted' ({payload['submitted']}) must count every accepted job (at least {len(listing)})."
    )
    snapshot = health()
    assert payload["queued_now"] == snapshot["queue_depth"], (
        "'queued_now' must match /healthz queue_depth."
    )
    assert payload["running_now"] == snapshot["running"], "'running_now' must match /healthz running."

    before = payload["submitted"]
    accepted = submit_path(RELEASE_NOTES)
    assert accepted.status_code == 201
    assert metrics()["submitted"] == before + 1, (
        "Each accepted job must increase 'submitted' by exactly 1."
    )
    wait_for_terminal(accepted.json()["job_id"], timeout=180)


def test_state_survives_restart(gateway, handbook_job):
    wait_until_idle()
    finished_job_id = handbook_job["final"]["job_id"]
    markdown_before = fetch_result(finished_job_id, "markdown").text
    document_before = fetch_result(finished_job_id, "json").json()["document"]
    chunks_before = fetch_result(finished_job_id, "chunks").json()

    restart_key = "zealt-key-restart"
    keyed = submit_upload(RELEASE_NOTES, idempotency_key=restart_key)
    assert keyed.status_code == 201, "The pre-restart keyed submission must be accepted."
    keyed_job_id = keyed.json()["job_id"]
    wait_for_terminal(keyed_job_id, timeout=180)

    interrupted = submit_upload(HANDBOOK, pace_seconds=25)
    assert interrupted.status_code == 201
    interrupted_id = interrupted.json()["job_id"]
    wait_for_state(interrupted_id, {"running", "queued"}, timeout=30)

    metrics_before = metrics()
    listing_before = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 100}, timeout=15).json()

    graceful = gateway.stop(grace=10)
    assert graceful, "The gateway must exit within 10 seconds of receiving SIGTERM."
    gateway.start()

    recovered = get_job(finished_job_id)
    assert recovered.status_code == 200, (
        "A job that succeeded before the restart must still be retrievable afterwards."
    )
    recovered_job = recovered.json()
    assert_job_shape(recovered_job)
    assert recovered_job["state"] == "succeeded", (
        f"The pre-restart succeeded job must still be 'succeeded', got {recovered_job['state']!r}."
    )
    assert fetch_result(finished_job_id, "markdown").text == markdown_before, (
        "The markdown result must be identical after a restart."
    )
    assert fetch_result(finished_job_id, "json").json()["document"] == document_before, (
        "The structured document result must be identical after a restart."
    )
    assert fetch_result(finished_job_id, "chunks").json() == chunks_before, (
        "The chunk result must be identical after a restart."
    )

    repaired = get_job(interrupted_id).json()
    assert repaired["state"] == "failed", (
        f"A job that was queued/running at shutdown must be repaired to 'failed', got {repaired['state']!r}."
    )
    assert repaired["error"] is not None and repaired["error"]["code"] == "INTERRUPTED", (
        f"An interrupted job must carry error code INTERRUPTED, got {repaired['error']!r}."
    )
    assert repaired["finished_at"] is not None, "A repaired job must have a non-null finished_at."

    metrics_after = metrics()
    assert metrics_after["submitted"] == metrics_before["submitted"], (
        f"'submitted' must be derived from durable state and survive a restart "
        f"({metrics_before['submitted']} -> {metrics_after['submitted']})."
    )
    assert metrics_after["succeeded"] == metrics_before["succeeded"], (
        "'succeeded' must survive a restart unchanged."
    )
    assert metrics_after["idempotent_hits"] == 0, (
        f"'idempotent_hits' is a per-process counter and must reset on restart, got {metrics_after['idempotent_hits']}."
    )
    assert metrics_after["rejected_queue_full"] == 0, (
        f"'rejected_queue_full' is a per-process counter and must reset on restart, got "
        f"{metrics_after['rejected_queue_full']}."
    )

    listing_after = requests.get(f"{BASE_URL}/v1/jobs", params={"limit": 100}, timeout=15).json()
    assert listing_after["count"] == listing_before["count"], (
        f"All jobs must survive the restart ({listing_before['count']} -> {listing_after['count']})."
    )

    replay = submit_upload(RELEASE_NOTES, idempotency_key=restart_key)
    assert replay.status_code == 200, (
        f"Idempotency keys must survive a restart; replay returned HTTP {replay.status_code}."
    )
    assert replay.json()["job_id"] == keyed_job_id, (
        "A post-restart replay must return the same job id as before the restart."
    )

    next_job = submit_path(RELEASE_NOTES)
    assert next_job.status_code == 201
    assert next_job.json()["seq"] > listing_before["jobs"][0]["seq"], (
        "seq must keep increasing across a restart and must never be reused."
    )
    wait_for_terminal(next_job.json()["job_id"], timeout=180)


def test_job_timeout_budget_is_enforced(gateway):
    wait_until_idle()
    gateway.stop(grace=10)
    gateway.start(extra_env={"GATEWAY_JOB_TIMEOUT_SECONDS": "3"})
    job_id = None
    try:
        response = submit_upload(HANDBOOK, pace_seconds=12)
        assert response.status_code == 201, (
            f"The paced submission must be accepted, got HTTP {response.status_code}: {response.text[:300]}"
        )
        job_id = response.json()["job_id"]
        final = wait_for_terminal(job_id, timeout=60)
        assert final["state"] == "failed", (
            f"A job exceeding GATEWAY_JOB_TIMEOUT_SECONDS must end as 'failed', got {final['state']!r}."
        )
        assert final["error"] is not None and final["error"]["code"] == "JOB_TIMEOUT", (
            f"A timed-out job must carry error code JOB_TIMEOUT, got {final['error']!r}."
        )
        assert final["finished_at"] is not None, "A timed-out job must record finished_at."
    finally:
        if job_id:
            drain([job_id])
        gateway.stop(grace=10)
        gateway.start()
