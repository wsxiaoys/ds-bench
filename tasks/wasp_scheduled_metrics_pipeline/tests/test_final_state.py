import json
import math
import os
import socket
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/waspmetrics"
START_SCRIPT = "/home/user/waspmetrics/start.sh"

# Always use the IPv4 loopback explicitly: `localhost` may resolve to ::1 while
# the dev servers listen on 0.0.0.0, which would make readiness checks hang.
HOST = "127.0.0.1"
SERVER_PORT = 3001
CLIENT_PORT = 3000
SERVER_URL = f"http://{HOST}:{SERVER_PORT}"
CLIENT_URL = f"http://{HOST}:{CLIENT_PORT}"

METRICS = ["error_rate", "latency_ms", "queue_depth"]
DASHBOARD_KEYS = {"metric", "count", "p95", "avg", "delta", "updatedAt"}

T0 = datetime(2030, 3, 1, 12, 0, 0, tzinfo=timezone.utc)

TOLERANCE = 1e-6


def iso(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + (
        f"{moment.microsecond // 1000:03d}Z"
    )


def at(offset_seconds: int) -> str:
    """ISO timestamp for `T0 - offset_seconds`."""
    return iso(T0 - timedelta(seconds=offset_seconds))


def post_sample(idempotency_key, body, timeout=30):
    headers = {"Content-Type": "application/json"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return requests.post(
        f"{SERVER_URL}/api/samples", json=body, headers=headers, timeout=timeout
    )


def sample_body(metric, value, recorded_at):
    return {"metric": metric, "value": value, "recordedAt": recorded_at}


def ingest(idempotency_key, metric, value, offset_seconds):
    return post_sample(idempotency_key, sample_body(metric, value, at(offset_seconds)))


def get_dashboard(timeout=30):
    return requests.get(f"{SERVER_URL}/api/dashboard", timeout=timeout)


def dashboard_by_metric(payload):
    return {entry.get("metric"): entry for entry in payload if isinstance(entry, dict)}


def psql(sql, timeout=60):
    database_url = os.environ.get("DATABASE_URL", "")
    assert database_url, "DATABASE_URL is not set in the verification environment."
    result = subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", "|", "-c", sql],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return result


def numbers_close(actual, expected):
    if expected is None:
        return actual is None
    if actual is None or isinstance(actual, bool) or not isinstance(actual, (int, float)):
        return False
    return math.isclose(float(actual), float(expected), abs_tol=TOLERANCE)


@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "waspmetrics"
        args = ["bash", START_SCRIPT]
        # CRITICAL: `env` must be a class attribute, never inside popen_kwargs.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 600
        terminate_on_interrupt = True

        def startup_check(self):
            for port in (SERVER_PORT, CLIENT_PORT):
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(5)
                    if s.connect_ex((HOST, port)) != 0:
                        return False
            try:
                client = requests.get(CLIENT_URL, timeout=30)
                if client.status_code >= 500:
                    return False
                server = requests.get(f"{SERVER_URL}/api/dashboard", timeout=30)
                return server.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        try:
            with open(info.logpath, "r") as f:
                all_lines = f.readlines()
        except OSError:
            return
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"===== [{tag}: Begin] waspmetrics log =====")
        if skipped:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"===== [{tag}: End  ] waspmetrics log =====")

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
def pipeline(start_app):
    """Drives the whole verification scenario once and records raw results."""
    state = {}

    # --- 1. Input validation -------------------------------------------------
    validation = []
    validation.append(
        (
            "unregistered metric",
            post_sample("v-bad-1", sample_body("cpu_temp", 1.0, at(0))),
        )
    )
    validation.append(
        (
            "non-numeric value",
            post_sample("v-bad-2", sample_body("latency_ms", "abc", at(0))),
        )
    )
    validation.append(
        (
            "unparsable recordedAt",
            post_sample(
                "v-bad-3",
                {"metric": "latency_ms", "value": 1.0, "recordedAt": "not-a-date"},
            ),
        )
    )
    validation.append(
        (
            "missing Idempotency-Key header",
            post_sample(None, sample_body("latency_ms", 1.0, at(0))),
        )
    )
    state["validation"] = validation

    # --- 2. Untrusted client-supplied fields ---------------------------------
    untrusted_body = {
        "id": 987654321,
        "ingestedAt": "1999-01-01T00:00:00.000Z",
        "metric": "error_rate",
        "value": 0.125,
        "recordedAt": at(2400),
    }
    state["untrusted"] = post_sample("v-untrusted-1", untrusted_body)

    # --- 3. Concurrent idempotent ingestion ----------------------------------
    duplicate_body = sample_body("queue_depth", 7.5, at(0))

    def send_duplicate(_index):
        try:
            response = post_sample("v-dup-queue-1", duplicate_body, timeout=60)
            return response.status_code, response.text
        except requests.RequestException as exc:  # pragma: no cover - network hiccup
            return None, f"request failed: {exc}"

    started_at = time.time()
    with ThreadPoolExecutor(max_workers=25) as pool:
        state["concurrent"] = list(pool.map(send_duplicate, range(25)))
    state["concurrent_seconds"] = time.time() - started_at

    # --- 4. Verification dataset ---------------------------------------------
    dataset = []
    for k in range(1, 21):
        dataset.append((f"v-lat-cur-{k}", "latency_ms", 10.0 * k, (20 - k) * 60))
    dataset.append(("v-lat-boundary", "latency_ms", 1000.0, 3600))
    dataset.append(("v-lat-prev-1", "latency_ms", 100.0, 3700))
    dataset.append(("v-lat-prev-2", "latency_ms", 300.0, 5000))
    dataset.append(("v-err-cur-1", "error_rate", 0.5, 60))
    dataset.append(("v-err-cur-2", "error_rate", 0.25, 600))
    dataset.append(("v-err-cur-3", "error_rate", 0.0625, 1800))
    dataset.append(("v-err-prev-1", "error_rate", 0.4, 4000))
    dataset.append(("v-err-prev-2", "error_rate", 0.2, 5000))

    ingest_results = []
    for key, metric, value, offset in dataset:
        response = ingest(key, metric, value, offset)
        ingest_results.append((key, response.status_code, response.text))
    state["ingest"] = ingest_results

    # --- 5. Dashboard must not be computed on the fly ------------------------
    pre_rollup = get_dashboard()
    state["pre_rollup_status"] = pre_rollup.status_code
    try:
        state["pre_rollup_body"] = pre_rollup.json()
    except ValueError:
        state["pre_rollup_body"] = None
    state["pre_rollup_text"] = pre_rollup.text

    # --- 6. Trigger a rollup --------------------------------------------------
    rollup = requests.post(f"{SERVER_URL}/api/rollup", timeout=60)
    state["rollup_status"] = rollup.status_code
    try:
        state["rollup_body"] = rollup.json()
    except ValueError:
        state["rollup_body"] = None
    state["rollup_text"] = rollup.text

    manual_job_id = None
    if isinstance(state["rollup_body"], dict):
        candidate = state["rollup_body"].get("jobId")
        if isinstance(candidate, str):
            manual_job_id = candidate
    state["manual_job_id"] = manual_job_id

    # --- 7. Wait for the rolled-up values ------------------------------------
    def latency_is_rolled_up(payload):
        entries = dashboard_by_metric(payload)
        latency = entries.get("latency_ms")
        if not isinstance(latency, dict):
            return False
        return numbers_close(latency.get("count"), 20) and numbers_close(
            latency.get("p95"), 190
        )

    state["post_rollup_body"] = None
    deadline = time.time() + 90
    while time.time() < deadline:
        response = get_dashboard()
        payload = None
        try:
            payload = response.json()
        except ValueError:
            payload = None
        if isinstance(payload, list):
            state["post_rollup_body"] = payload
            if latency_is_rolled_up(payload):
                break
        time.sleep(2)
    state["observed_after_rollup_at"] = datetime.now(timezone.utc)

    # --- 8. pg-boss bookkeeping for the manual job ---------------------------
    job_row = None
    if manual_job_id:
        job_deadline = time.time() + 90
        while time.time() < job_deadline:
            result = psql(
                "SELECT name, data::text, state FROM pgboss.job "
                f"WHERE id = '{manual_job_id}'"
            )
            row = (result.stdout or "").strip()
            if row:
                job_row = row
                if row.split("|")[-1] == "completed":
                    break
            time.sleep(3)
    state["manual_job_row"] = job_row

    # --- 9. Recurring schedule ------------------------------------------------
    schedule_result = psql(
        "SELECT cron, data::text FROM pgboss.schedule WHERE name = 'rollupMetrics'"
    )
    state["schedule_stdout"] = (schedule_result.stdout or "").strip()
    state["schedule_stderr"] = schedule_result.stderr

    # --- 10. Externally enqueued work item -----------------------------------
    external_ingest = ingest("v-queue-external-1", "queue_depth", 9.5, 30)
    state["external_ingest"] = (external_ingest.status_code, external_ingest.text)

    insert_result = psql(
        "INSERT INTO pgboss.job (name, data) "
        "VALUES ('rollupMetrics', '{\"reason\": \"external\"}'::jsonb)"
    )
    state["external_insert_returncode"] = insert_result.returncode
    state["external_insert_stderr"] = insert_result.stderr

    state["external_body"] = None
    deadline = time.time() + 120
    while time.time() < deadline:
        response = get_dashboard()
        try:
            payload = response.json()
        except ValueError:
            payload = None
        if isinstance(payload, list):
            state["external_body"] = payload
            entry = dashboard_by_metric(payload).get("queue_depth")
            if isinstance(entry, dict) and numbers_close(entry.get("count"), 2):
                break
        time.sleep(3)

    return state


def test_input_validation_rejects_bad_samples(pipeline):
    for label, response in pipeline["validation"]:
        assert response.status_code == 400, (
            f"Expected status 400 for the '{label}' case, got {response.status_code}: "
            f"{response.text}"
        )
        try:
            body = response.json()
        except ValueError:
            pytest.fail(f"Response for the '{label}' case is not JSON: {response.text}")
        assert isinstance(body, dict) and "error" in body, (
            f"Expected a JSON body containing the key 'error' for the '{label}' case, "
            f"got: {body}"
        )


def test_untrusted_body_fields_are_ignored(pipeline):
    response = pipeline["untrusted"]
    assert response.status_code == 201, (
        "Expected status 201 when ingesting a valid sample carrying untrusted 'id' and "
        f"'ingestedAt' fields, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert body.get("duplicate") is False, (
        f"Expected 'duplicate' to be false for a first-time Idempotency-Key, got: {body}"
    )
    assert body.get("id") != 987654321, (
        "The server must not use the client-supplied 'id' (987654321) as the stored "
        f"sample identifier, got: {body}"
    )


def test_concurrent_requests_with_same_idempotency_key(pipeline):
    results = pipeline["concurrent"]
    assert len(results) == 25, f"Expected 25 concurrent responses, got {len(results)}."
    statuses = [status for status, _ in results]
    assert all(status is not None for status in statuses), (
        f"Some concurrent ingestion requests failed to complete: {results}"
    )
    created = [status for status in statuses if status == 201]
    duplicates = [status for status in statuses if status == 200]
    assert len(created) == 1, (
        "Exactly one of the 25 concurrent requests with the same Idempotency-Key must "
        f"return 201, got statuses: {statuses}"
    )
    assert len(duplicates) == 24, (
        "The other 24 concurrent requests with the same Idempotency-Key must return 200, "
        f"got statuses: {statuses}"
    )
    ids = set()
    for status, text in results:
        body = json.loads(text)
        assert "id" in body, f"Response body is missing the 'id' key: {body}"
        ids.add(body["id"])
        if status == 200:
            assert body.get("duplicate") is True, (
                f"Duplicate responses must report 'duplicate': true, got: {body}"
            )
    assert len(ids) == 1, (
        f"All concurrent responses must report the same sample id, got ids: {ids}"
    )
    assert pipeline["concurrent_seconds"] < 120, (
        "The 25 concurrent ingestion requests took "
        f"{pipeline['concurrent_seconds']:.1f}s, which suggests a deadlock or livelock."
    )


def test_verification_dataset_was_ingested(pipeline):
    failures = [
        (key, status, text)
        for key, status, text in pipeline["ingest"]
        if status != 201
    ]
    assert not failures, (
        f"Expected every verification sample to be accepted with status 201, failures: "
        f"{failures}"
    )


def test_dashboard_shape_and_no_live_computation(pipeline):
    assert pipeline["pre_rollup_status"] == 200, (
        f"GET /api/dashboard returned {pipeline['pre_rollup_status']}: "
        f"{pipeline['pre_rollup_text']}"
    )
    payload = pipeline["pre_rollup_body"]
    assert isinstance(payload, list), (
        f"GET /api/dashboard must return a JSON array, got: {pipeline['pre_rollup_text']}"
    )
    assert len(payload) == 3, (
        f"Expected exactly 3 dashboard entries, got {len(payload)}: {payload}"
    )
    assert [entry.get("metric") for entry in payload] == METRICS, (
        "Dashboard entries must be ordered by metric ascending "
        f"({METRICS}), got: {[entry.get('metric') for entry in payload]}"
    )
    for entry in payload:
        assert set(entry.keys()) == DASHBOARD_KEYS, (
            f"Each dashboard entry must have exactly the keys {sorted(DASHBOARD_KEYS)}, "
            f"got: {sorted(entry.keys())}"
        )
    latency = dashboard_by_metric(payload)["latency_ms"]
    already_rolled_up = numbers_close(latency.get("count"), 20) and numbers_close(
        latency.get("p95"), 190
    )
    assert not already_rolled_up, (
        "The dashboard already reported the freshly ingested samples before any rollup "
        f"ran, so it is computed on the fly instead of serving persisted results: {latency}"
    )


def test_rollup_endpoint_enqueues_the_job(pipeline):
    assert pipeline["rollup_status"] == 202, (
        f"POST /api/rollup must return status 202, got {pipeline['rollup_status']}: "
        f"{pipeline['rollup_text']}"
    )
    body = pipeline["rollup_body"]
    assert isinstance(body, dict), (
        f"POST /api/rollup must return a JSON object, got: {pipeline['rollup_text']}"
    )
    assert body.get("jobName") == "rollupMetrics", (
        f"Expected 'jobName' to be 'rollupMetrics', got: {body}"
    )
    job_id = body.get("jobId")
    assert isinstance(job_id, str) and job_id.strip(), (
        f"Expected 'jobId' to be a non-empty string, got: {body}"
    )


def test_dashboard_reports_rolled_up_statistics(pipeline):
    payload = pipeline["post_rollup_body"]
    assert isinstance(payload, list), (
        "GET /api/dashboard did not return a JSON array after the rollup was triggered."
    )
    entries = dashboard_by_metric(payload)
    expected = {
        "error_rate": {"count": 4, "p95": 0.5, "avg": 0.234, "delta": 0.1},
        "latency_ms": {"count": 20, "p95": 190, "avg": 105, "delta": -810},
        "queue_depth": {"count": 1, "p95": 7.5, "avg": 7.5, "delta": None},
    }
    for metric, fields in expected.items():
        entry = entries.get(metric)
        assert isinstance(entry, dict), (
            f"Dashboard is missing an entry for '{metric}': {payload}"
        )
        for field, value in fields.items():
            assert numbers_close(entry.get(field), value), (
                f"Expected {metric}.{field} to be {value}, got {entry.get(field)} "
                f"(full entry: {entry})"
            )
        updated_at = entry.get("updatedAt")
        assert isinstance(updated_at, str) and updated_at.endswith("Z"), (
            f"Expected {metric}.updatedAt to be an ISO-8601 UTC string ending in 'Z', "
            f"got: {updated_at}"
        )
        try:
            parsed = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        except ValueError:
            pytest.fail(f"{metric}.updatedAt is not a parsable ISO-8601 timestamp: {updated_at}")
        age = (pipeline["observed_after_rollup_at"] - parsed).total_seconds()
        assert -60 <= age <= 900, (
            f"Expected {metric}.updatedAt to be the recent rollup time, got {updated_at} "
            f"({age:.0f}s away from the observation time)."
        )


def test_manual_rollup_went_through_the_job_queue(pipeline):
    row = pipeline["manual_job_row"]
    job_id = pipeline["manual_job_id"]
    assert row, (
        f"No pgboss.job row found with id '{job_id}' returned by POST /api/rollup."
    )
    parts = row.split("|")
    assert len(parts) >= 3, f"Unexpected pgboss.job row format: {row!r}"
    name, data_text, state = parts[0], parts[1], parts[-1]
    assert name == "rollupMetrics", (
        f"Expected the enqueued job name to be 'rollupMetrics', got: {name!r}"
    )
    assert json.loads(data_text) == {"reason": "manual"}, (
        f"Expected the manual job argument to be {{'reason': 'manual'}}, got: {data_text!r}"
    )
    assert state == "completed", (
        f"Expected the manual rollup job to reach state 'completed', got: {state!r}"
    )


def test_recurring_schedule_is_registered(pipeline):
    stdout = pipeline["schedule_stdout"]
    assert stdout, (
        "No pgboss.schedule row found for the job 'rollupMetrics'. "
        f"psql stderr: {pipeline['schedule_stderr']}"
    )
    line = stdout.splitlines()[0]
    parts = line.split("|")
    assert len(parts) >= 2, f"Unexpected pgboss.schedule row format: {line!r}"
    cron, data_text = parts[0], parts[1]
    assert cron == "23 3 * * *", (
        f"Expected the recurring rollup cron expression to be '23 3 * * *', got: {cron!r}"
    )
    assert json.loads(data_text) == {"reason": "cron"}, (
        f"Expected the scheduled job argument to be {{'reason': 'cron'}}, got: {data_text!r}"
    )


def test_externally_enqueued_job_is_processed(pipeline):
    assert pipeline["external_ingest"][0] == 201, (
        "Failed to ingest the additional queue_depth sample: "
        f"{pipeline['external_ingest']}"
    )
    assert pipeline["external_insert_returncode"] == 0, (
        "Failed to enqueue a 'rollupMetrics' work item directly in the database: "
        f"{pipeline['external_insert_stderr']}"
    )
    payload = pipeline["external_body"]
    assert isinstance(payload, list), (
        "GET /api/dashboard did not return a JSON array after the externally enqueued "
        "work item."
    )
    entry = dashboard_by_metric(payload).get("queue_depth")
    assert isinstance(entry, dict), f"Dashboard is missing 'queue_depth': {payload}"
    for field, value in (("count", 2), ("p95", 9.5), ("avg", 8.5), ("delta", None)):
        assert numbers_close(entry.get(field), value), (
            "The rollup work item enqueued directly into the queue was not processed as "
            f"expected: queue_depth.{field} is {entry.get(field)}, expected {value} "
            f"(full entry: {entry})"
        )


def test_dashboard_page_renders_metrics(pipeline):
    from playwright.sync_api import sync_playwright

    api_entries = dashboard_by_metric(get_dashboard().json())

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page()
            page.goto(CLIENT_URL, wait_until="load", timeout=120000)
            page.wait_for_selector('[data-metric="latency_ms"]', timeout=120000)
            rendered = {}
            for metric in METRICS:
                container = page.query_selector(f'[data-metric="{metric}"]')
                assert container is not None, (
                    f"The dashboard page has no element with data-metric=\"{metric}\"."
                )
                fields = {}
                for field in ("count", "p95", "avg", "delta", "updatedAt"):
                    element = container.query_selector(f'[data-field="{field}"]')
                    assert element is not None, (
                        f"The element for metric '{metric}' has no descendant with "
                        f'data-field="{field}".'
                    )
                    fields[field] = (element.inner_text() or "").strip()
                rendered[metric] = fields
        finally:
            browser.close()

    for metric in METRICS:
        for field in ("count", "p95", "avg"):
            text = rendered[metric][field]
            expected = api_entries[metric][field]
            assert expected is not None, (
                f"Unexpected null for {metric}.{field} in the API response: "
                f"{api_entries[metric]}"
            )
            try:
                shown = float(text)
            except ValueError:
                pytest.fail(
                    f"The rendered value for {metric}.{field} is not a number: {text!r}"
                )
            assert numbers_close(shown, expected), (
                f"The page shows {metric}.{field} as {text!r} while the API reports "
                f"{expected}."
            )
    assert rendered["queue_depth"]["delta"] == "-", (
        "A null value must be rendered as '-', but the page shows "
        f"{rendered['queue_depth']['delta']!r} for queue_depth.delta."
    )
