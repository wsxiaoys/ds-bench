import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "aggregate_result.json")


def test_aggregate_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "aggregate.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node aggregate.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"aggregate_result.json must exist at {RESULT_FILE}"


def test_totals_count():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data["totals"]["count"] == 6, (
        f"totals.count must be 6; got: {data['totals'].get('count')}"
    )


def test_totals_sum():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert abs(data["totals"]["sum"] - 660.0) < 0.01, (
        f"totals.sum must be 660; got: {data['totals'].get('sum')}"
    )


def test_totals_avg():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert abs(data["totals"]["avg"] - 110.0) < 0.01, (
        f"totals.avg must be 110; got: {data['totals'].get('avg')}"
    )


def test_by_status_has_two_groups():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    by_status = data.get("byStatus", [])
    assert len(by_status) == 2, (
        f"byStatus must have 2 groups; got {len(by_status)}: {by_status}"
    )


def test_by_status_pending_sum():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    pending = next((g for g in data.get("byStatus", []) if g.get("status") == "pending"), None)
    assert pending is not None, "byStatus must contain a 'pending' group"
    assert abs(pending.get("_sum", {}).get("amount", 0) - 60.0) < 0.01, (
        f"pending sum must be 60; got: {pending.get('_sum', {}).get('amount')}"
    )


def test_by_status_completed_sum():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    completed = next((g for g in data.get("byStatus", []) if g.get("status") == "completed"), None)
    assert completed is not None, "byStatus must contain a 'completed' group"
    assert abs(completed.get("_sum", {}).get("amount", 0) - 600.0) < 0.01, (
        f"completed sum must be 600; got: {completed.get('_sum', {}).get('amount')}"
    )
