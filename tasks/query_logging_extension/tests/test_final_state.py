import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
LOG_FILE = os.path.join(PROJECT_DIR, "query.log")
RESULT_FILE = os.path.join(PROJECT_DIR, "logging_result.json")


def test_logging_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "logging.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node logging.js must exit 0; stderr={result.stderr.strip()}"


def test_query_log_exists():
    assert os.path.isfile(LOG_FILE), f"query.log must exist at {LOG_FILE}"


def test_query_log_has_at_least_three_lines():
    with open(LOG_FILE) as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]
    assert len(lines) >= 3, (
        f"query.log must have at least 3 lines; found {len(lines)}"
    )


def test_query_log_lines_are_valid_json():
    with open(LOG_FILE) as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]
    for i, line in enumerate(lines):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            raise AssertionError(f"Line {i+1} in query.log must be valid JSON; got: {line!r}")
        assert "operation" in obj, f"Line {i+1} must have 'operation' key; got: {obj}"
        assert "model" in obj, f"Line {i+1} must have 'model' key; got: {obj}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"logging_result.json must exist at {RESULT_FILE}"


def test_logged_queries_count():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("loggedQueries", 0) >= 3, (
        f"loggedQueries must be >= 3; got: {data.get('loggedQueries')}"
    )
