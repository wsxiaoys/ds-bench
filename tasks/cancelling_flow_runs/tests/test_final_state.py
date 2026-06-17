import subprocess
import json
import pytest

def test_flow_run_cancelled_via_cli():
    """Priority 1: Use Prefect CLI to verify the flow run state."""
    result = subprocess.run(
        ["prefect", "flow-run", "ls", "--flow-name", "infinite_loop_flow", "-o", "json"],
        capture_output=True, text=True, cwd="/home/user/project"
    )
    assert result.returncode == 0, f"'prefect flow-run ls' failed: {result.stderr}"

    # Parse JSON from stdout (might contain log lines before/after)
    stdout = result.stdout.strip()
    start_idx = stdout.find('[')
    end_idx = stdout.rfind(']')

    assert start_idx != -1 and end_idx != -1, f"Could not find JSON array in output: {stdout}"

    json_str = stdout[start_idx:end_idx+1]
    flow_runs = json.loads(json_str)

    assert len(flow_runs) > 0, "No flow runs found for 'infinite_loop_flow'."

    cancelled = False
    for run in flow_runs:
        state_name = run.get("state_name", "")
        if state_name in ("Cancelled", "Cancelling"):
            cancelled = True
            break

    assert cancelled, f"Expected at least one flow run in 'Cancelled' or 'Cancelling' state, got states: {[r.get('state_name') for r in flow_runs]}"
