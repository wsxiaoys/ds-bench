import os
import socket
import subprocess
import time

import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
PORT = 5173
# Bind/connect over IPv4 explicitly. On Node 17+ `localhost` can resolve to the
# IPv6 loopback (::1), so Vite would listen on ::1 only while an AF_INET socket
# to 127.0.0.1 never connects -> the readiness check would hang for the full
# timeout and raise a confusing TimeoutError.
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"


def _apply_migrations():
    """Apply Drizzle/D1 migrations to the local database (idempotent)."""
    result = subprocess.run(
        ["npx", "wrangler", "d1", "migrations", "apply", "DB", "--local"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=os.environ.copy(),
        timeout=300,
    )
    print("============================== [migrations apply stdout] ==============================")
    print(result.stdout)
    print("============================== [migrations apply stderr] ==============================")
    print(result.stderr)


@pytest.fixture(scope="session")
def start_app(xprocess):
    """Apply migrations, then start the RedwoodSDK dev server on port 5173."""
    _apply_migrations()

    class Starter(ProcessStarter):
        name = "start_app"
        # `--host 127.0.0.1` forces Vite to bind the IPv4 loopback so it matches
        # the address the readiness check and the tests connect to.
        args = ["npm", "run", "dev", "--", "--host", HOST]
        # CRITICAL: set `env` as a class attribute here, NEVER inside `popen_kwargs`.
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 240
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            # Port is open; confirm the HTTP server actually responds. Accept any
            # non-5xx status so a genuinely broken app fails later with a clear
            # assertion instead of masquerading as a startup TimeoutError. The
            # first request triggers rwsdk/Vite on-demand bundling, so allow more
            # than a couple of seconds for it.
            try:
                resp = requests.get(f"{BASE_URL}/api/records", timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield

    capture_logs("TEARDOWN")
    info.terminate()


def _create_record(label, expires_at):
    resp = requests.post(
        f"{BASE_URL}/api/records",
        json={"label": label, "expiresAt": expires_at},
        timeout=15,
    )
    return resp


def _list_records():
    resp = requests.get(f"{BASE_URL}/api/records", timeout=15)
    return resp


def test_cron_data_cleanup_flow(start_app):
    now = int(time.time() * 1000)
    expired_at = now - 3_600_000  # one hour in the past
    fresh_at = now + 3_600_000  # one hour in the future

    # Step 1: create an already-expired record.
    expired_resp = _create_record("stale", expired_at)
    assert expired_resp.status_code == 201, (
        f"POST /api/records for an expired record should return 201, "
        f"got {expired_resp.status_code}: {expired_resp.text}"
    )
    expired_body = expired_resp.json()
    assert isinstance(expired_body.get("id"), str) and expired_body["id"], (
        f"Created record must include a string 'id', got: {expired_body}"
    )
    assert expired_body.get("label") == "stale", (
        f"Created record 'label' should be 'stale', got: {expired_body}"
    )
    assert expired_body.get("expiresAt") == expired_at, (
        f"Created record 'expiresAt' should be {expired_at}, got: {expired_body}"
    )
    expired_id = expired_body["id"]

    # Step 2: create a not-yet-expired record.
    fresh_resp = _create_record("fresh", fresh_at)
    assert fresh_resp.status_code == 201, (
        f"POST /api/records for a fresh record should return 201, "
        f"got {fresh_resp.status_code}: {fresh_resp.text}"
    )
    fresh_body = fresh_resp.json()
    assert isinstance(fresh_body.get("id"), str) and fresh_body["id"], (
        f"Created record must include a string 'id', got: {fresh_body}"
    )
    assert fresh_body.get("label") == "fresh", (
        f"Created record 'label' should be 'fresh', got: {fresh_body}"
    )
    assert fresh_body.get("expiresAt") == fresh_at, (
        f"Created record 'expiresAt' should be {fresh_at}, got: {fresh_body}"
    )
    fresh_id = fresh_body["id"]

    assert expired_id != fresh_id, "Each created record must receive a distinct id."

    # Step 3: both records must exist before cleanup.
    before_resp = _list_records()
    assert before_resp.status_code == 200, (
        f"GET /api/records should return 200, got {before_resp.status_code}: {before_resp.text}"
    )
    before = before_resp.json()
    assert isinstance(before, list), f"GET /api/records should return a JSON array, got: {before}"
    before_ids = {r.get("id") for r in before}
    assert expired_id in before_ids, (
        f"Expired record id {expired_id} should be present before cleanup, got ids: {before_ids}"
    )
    assert fresh_id in before_ids, (
        f"Fresh record id {fresh_id} should be present before cleanup, got ids: {before_ids}"
    )

    # Step 4: trigger the scheduled cleanup handler for the configured cron.
    scheduled_resp = requests.get(
        f"{BASE_URL}/cdn-cgi/handler/scheduled?cron=0+*+*+*+*", timeout=30
    )
    assert scheduled_resp.status_code == 200, (
        f"Triggering the scheduled handler should succeed with 200, "
        f"got {scheduled_resp.status_code}: {scheduled_resp.text}"
    )

    # Give the async cleanup a brief moment to settle.
    time.sleep(2)

    # Step 5: the expired record must be gone; the fresh record must remain.
    after_resp = _list_records()
    assert after_resp.status_code == 200, (
        f"GET /api/records should return 200 after cleanup, "
        f"got {after_resp.status_code}: {after_resp.text}"
    )
    after = after_resp.json()
    assert isinstance(after, list), f"GET /api/records should return a JSON array, got: {after}"
    after_ids = {r.get("id") for r in after}
    assert expired_id not in after_ids, (
        f"Expired record id {expired_id} should have been deleted by the scheduled "
        f"cleanup, but it is still present. Records after cleanup: {after}"
    )
    assert fresh_id in after_ids, (
        f"Fresh (non-expired) record id {fresh_id} should still be present after cleanup, "
        f"but it is missing. Records after cleanup: {after}"
    )

    fresh_after = next(r for r in after if r.get("id") == fresh_id)
    assert fresh_after.get("label") == "fresh", (
        f"Surviving record should keep label 'fresh', got: {fresh_after}"
    )
    assert fresh_after.get("expiresAt") == fresh_at, (
        f"Surviving record should keep expiresAt {fresh_at}, got: {fresh_after}"
    )
