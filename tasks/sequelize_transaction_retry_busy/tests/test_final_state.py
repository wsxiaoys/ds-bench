import json
import os
import sqlite3
import subprocess
import uuid

import pytest

PROJECT_DIR = "/home/user/project"
RUNNER = os.path.join(PROJECT_DIR, "src", "runner.js")
CLI = os.path.join(PROJECT_DIR, "run.js")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _run_node_code(code, timeout=120):
    """Write a temporary Node script inside PROJECT_DIR (so `require('sequelize')`
    resolves against the project's node_modules) and execute it."""
    script_path = os.path.join(PROJECT_DIR, f".harness_{uuid.uuid4().hex}.js")
    with open(script_path, "w") as f:
        f.write(code)
    try:
        return subprocess.run(
            ["node", script_path],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    finally:
        try:
            os.remove(script_path)
        except OSError:
            pass


def _extract_json_line(stdout, required_key):
    """Return the last stdout line that parses as a JSON object containing
    `required_key`. Tolerates extraneous log lines."""
    found = None
    for line in stdout.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict) and required_key in obj:
            found = obj
    return found


BUSY_ERROR_JS = """
function busyError() {
  const inner = new Error('SQLITE_BUSY: database is locked');
  inner.code = 'SQLITE_BUSY';
  inner.errno = 5;
  const e = new Error('SQLITE_BUSY: database is locked');
  e.code = 'SQLITE_BUSY';
  e.errno = 5;
  e.name = 'SequelizeDatabaseError';
  e.original = inner;
  e.parent = inner;
  return e;
}
"""


# --------------------------------------------------------------------------- #
# Static existence checks (files the executor must create)
# --------------------------------------------------------------------------- #
def test_runner_module_exists():
    assert os.path.isfile(RUNNER), f"Expected transaction runner module at {RUNNER}."


def test_cli_entrypoint_exists():
    assert os.path.isfile(CLI), f"Expected CLI entrypoint at {CLI}."


def test_runner_exports_expected_functions():
    code = f"""
const m = require('{RUNNER}');
const names = ['createDatabase', 'withRetry', 'increment'];
const missing = names.filter((n) => typeof m[n] !== 'function');
console.log(JSON.stringify({{ missing }}));
"""
    result = _run_node_code(code, timeout=60)
    assert result.returncode == 0, (
        f"Failed to require the runner module. stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    obj = _extract_json_line(result.stdout, "missing")
    assert obj is not None, f"Could not read exports report. stdout={result.stdout!r}"
    assert obj["missing"] == [], (
        f"runner.js must export functions createDatabase, withRetry, increment. Missing: {obj['missing']}"
    )


# --------------------------------------------------------------------------- #
# 1. Concurrency correctness / no lost updates (real SQLite file via CLI)
# --------------------------------------------------------------------------- #
@pytest.fixture()
def conc_db(tmp_path):
    db_path = os.path.join(PROJECT_DIR, f"data-conc-{uuid.uuid4().hex}.sqlite")
    yield db_path
    for suffix in ("", "-wal", "-shm", "-journal"):
        p = db_path + suffix
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass


def _cli(args, timeout=180):
    return subprocess.run(
        ["node", CLI, *args],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def test_concurrent_increments_no_lost_updates(conc_db):
    init = _cli(["init", "--db", conc_db])
    assert init.returncode == 0, (
        f"`init` failed. stdout={init.stdout!r} stderr={init.stderr!r}"
    )

    # Bound wall-clock time so a deadlock/livelock fails instead of hanging.
    run = _cli(
        [
            "run",
            "--db",
            conc_db,
            "--concurrency",
            "30",
            "--max-attempts",
            "50",
            "--base-delay-ms",
            "5",
        ],
        timeout=120,
    )
    assert run.returncode == 0, (
        f"`run` failed. stdout={run.stdout!r} stderr={run.stderr!r}"
    )

    obj = _extract_json_line(run.stdout, "successes")
    assert obj is not None, (
        f"`run` must print a JSON object with keys successes/total. stdout={run.stdout!r}"
    )
    assert obj.get("successes") == 30, (
        f"Expected all 30 concurrent increments to succeed, got {obj.get('successes')}."
    )
    assert obj.get("total") == 30, (
        f"Expected final counter total 30 in stdout, got {obj.get('total')}."
    )

    # Independently inspect the real SQLite file.
    assert os.path.isfile(conc_db), f"Database file {conc_db} was not created."
    conn = sqlite3.connect(conc_db)
    try:
        cur = conn.cursor()
        total = cur.execute("SELECT total FROM counters WHERE id = 1").fetchone()[0]
        assert total == 30, (
            f"counters.total must equal the number of successful increments (30), got {total} (lost update)."
        )

        n_audit = cur.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
        assert n_audit == 30, (
            f"Expected exactly one audit row per successful increment (30), got {n_audit}."
        )

        observed = [r[0] for r in cur.execute("SELECT observed FROM audit_logs ORDER BY observed").fetchall()]
        written = [r[0] for r in cur.execute("SELECT written FROM audit_logs ORDER BY written").fetchall()]
        assert observed == list(range(0, 30)), (
            f"Every increment must observe a distinct prior counter value 0..29 (serialized, no lost updates). "
            f"Got observed values: {observed}"
        )
        assert written == list(range(1, 31)), (
            f"Written values must be exactly 1..30. Got: {written}"
        )
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# 2. Non-retryable errors surface immediately (no retry)
# --------------------------------------------------------------------------- #
def test_non_retryable_error_is_not_retried():
    code = f"""
const {{ withRetry }} = require('{RUNNER}');
const {{ Sequelize }} = require('sequelize');
(async () => {{
  const sequelize = new Sequelize('sqlite::memory:', {{ logging: false }});
  let attempts = 0;
  let out = {{}};
  try {{
    await withRetry(sequelize, async () => {{
      attempts++;
      throw new Error('non-retryable boom');
    }}, {{ maxAttempts: 5, baseDelayMs: 1 }});
    out = {{ ok: true, attempts }};
  }} catch (e) {{
    out = {{ ok: false, attempts, message: String((e && e.message) || e) }};
  }} finally {{
    try {{ await sequelize.close(); }} catch (_) {{}}
  }}
  console.log(JSON.stringify(out));
}})();
"""
    result = _run_node_code(code)
    assert result.returncode == 0, (
        f"Harness crashed. stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    obj = _extract_json_line(result.stdout, "attempts")
    assert obj is not None, f"No result JSON produced. stdout={result.stdout!r}"
    assert obj["ok"] is False, "A non-retryable error must be surfaced (the call must reject)."
    assert obj["attempts"] == 1, (
        f"Non-retryable errors must NOT be retried; work should run exactly once, ran {obj['attempts']} times."
    )
    assert "non-retryable boom" in obj["message"], (
        f"The original error must be propagated unchanged. Got message: {obj['message']!r}"
    )


# --------------------------------------------------------------------------- #
# 3. Retries exhausted on persistent lock contention
# --------------------------------------------------------------------------- #
def test_retries_exhausted_on_persistent_busy():
    code = f"""
const {{ withRetry }} = require('{RUNNER}');
const {{ Sequelize }} = require('sequelize');
{BUSY_ERROR_JS}
(async () => {{
  const sequelize = new Sequelize('sqlite::memory:', {{ logging: false }});
  let attempts = 0;
  let out = {{}};
  try {{
    await withRetry(sequelize, async () => {{
      attempts++;
      throw busyError();
    }}, {{ maxAttempts: 4, baseDelayMs: 1 }});
    out = {{ ok: true, attempts }};
  }} catch (e) {{
    out = {{ ok: false, attempts, message: String((e && e.message) || e) }};
  }} finally {{
    try {{ await sequelize.close(); }} catch (_) {{}}
  }}
  console.log(JSON.stringify(out));
}})();
"""
    result = _run_node_code(code)
    assert result.returncode == 0, (
        f"Harness crashed. stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    obj = _extract_json_line(result.stdout, "attempts")
    assert obj is not None, f"No result JSON produced. stdout={result.stdout!r}"
    assert obj["ok"] is False, "Persistent lock contention must eventually cause the call to reject."
    assert obj["attempts"] == 4, (
        f"Work must be retried up to the attempt cap (maxAttempts=4), ran {obj['attempts']} times."
    )
    assert "retries exhausted" in obj["message"].lower(), (
        f"On exhaustion the thrown error must clearly indicate retries were exhausted. Got: {obj['message']!r}"
    )


# --------------------------------------------------------------------------- #
# 4. Retries then succeeds on a transient error
# --------------------------------------------------------------------------- #
def test_retries_then_succeeds_on_transient_busy():
    code = f"""
const {{ withRetry }} = require('{RUNNER}');
const {{ Sequelize }} = require('sequelize');
{BUSY_ERROR_JS}
(async () => {{
  const sequelize = new Sequelize('sqlite::memory:', {{ logging: false }});
  let attempts = 0;
  let out = {{}};
  try {{
    const result = await withRetry(sequelize, async () => {{
      attempts++;
      if (attempts <= 2) throw busyError();
      return 'ok';
    }}, {{ maxAttempts: 5, baseDelayMs: 1 }});
    out = {{ ok: true, attempts, result }};
  }} catch (e) {{
    out = {{ ok: false, attempts, message: String((e && e.message) || e) }};
  }} finally {{
    try {{ await sequelize.close(); }} catch (_) {{}}
  }}
  console.log(JSON.stringify(out));
}})();
"""
    result = _run_node_code(code)
    assert result.returncode == 0, (
        f"Harness crashed. stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    obj = _extract_json_line(result.stdout, "attempts")
    assert obj is not None, f"No result JSON produced. stdout={result.stdout!r}"
    assert obj["ok"] is True, (
        f"After transient lock errors clear, the call must succeed. Got: {obj}"
    )
    assert obj["attempts"] == 3, (
        f"Work should be retried past 2 transient failures and succeed on attempt 3, ran {obj['attempts']} times."
    )
    assert obj["result"] == "ok", (
        f"withRetry must return the value resolved by work. Got: {obj.get('result')!r}"
    )
