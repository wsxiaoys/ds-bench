#!/usr/bin/env python3
"""
Entrypoint that executes all three flow-state demonstration flows.

Usage:
    cd /home/user/flow_states && python3 run_all.py

Each flow produces a flow run on the local Prefect server with a distinct
terminal state: TimedOut, Crashed, or Failed.
"""

import subprocess
import sys
import time
import os

# Ensure we're running from the project directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from flows import timeout_flow, crash_flow, failure_flow, RUN_ID

PREFECT_API_URL = "http://127.0.0.1:4200/api"


def run_timeout_flow():
    """
    Run the timeout flow.  It has timeout_seconds=5 but sleeps 10s.
    Prefect will cancel it and set state name='TimedOut'.
    """
    print(f"\n{'='*60}")
    print(f"Running timeout-flow-{RUN_ID} ...")
    print(f"{'='*60}")
    try:
        timeout_flow(return_state=True)
    except Exception as e:
        print(f"Timeout flow raised (expected): {type(e).__name__}: {e}")


def run_crash_flow():
    """
    Run the crash flow in a subprocess so that when it raises SystemExit
    (which kills the process), the parent script survives.

    Prefect in the subprocess will register the Crashed state before the
    process exits.
    """
    print(f"\n{'='*60}")
    print(f"Running crash-flow-{RUN_ID} (in subprocess)...")
    print(f"{'='*60}")

    script = f"""
import sys
sys.path.insert(0, '{os.path.dirname(os.path.abspath(__file__))}')
from flows import crash_flow
try:
    crash_flow(return_state=True)
except SystemExit:
    pass
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=30,
    )
    print("STDOUT:", result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print(f"Crash subprocess exited with code {result.returncode}")


def run_failure_flow():
    """
    Run the failure flow.  It raises ValueError → state type FAILED.
    """
    print(f"\n{'='*60}")
    print(f"Running failure-flow-{RUN_ID} ...")
    print(f"{'='*60}")
    try:
        failure_flow(return_state=True)
    except Exception as e:
        print(f"Failure flow raised (expected): {type(e).__name__}: {e}")


def verify_runs():
    """Query the Prefect API to verify the three flow runs exist."""
    print(f"\n{'='*60}")
    print("Verifying flow runs on the server...")
    print(f"{'='*60}")

    import urllib.request
    import json

    # Give the server a moment to process all runs
    time.sleep(2)

    expected_names = [
        f"timeout-flow-{RUN_ID}",
        f"crash-flow-{RUN_ID}",
        f"failure-flow-{RUN_ID}",
    ]

    for name in expected_names:
        try:
            url = f"{PREFECT_API_URL}/flow_runs/filter"
            body = json.dumps({
                "flow_runs": {
                    "operator": "and_",
                    "name": {"any_": [name]},
                },
                "limit": 5,
            }).encode()
            req = urllib.request.Request(url, data=body, method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                runs = data if isinstance(data, list) else []
                if runs:
                    for run in runs:
                        state = run.get("state", {})
                        state_type = state.get("type", "UNKNOWN")
                        state_name = state.get("name", "UNKNOWN")
                        print(f"  {run['name']}: state_type={state_type}, state_name={state_name}")
                else:
                    print(f"  {name}: NOT FOUND")
        except Exception as e:
            print(f"  {name}: Error querying - {e}")


def main():
    print(f"Run ID: {RUN_ID}")
    print(f"Prefect API: {PREFECT_API_URL}")

    # 1. Run the failure flow first (simplest, always works)
    run_failure_flow()

    # 2. Run the timeout flow
    run_timeout_flow()

    # 3. Run the crash flow in a subprocess (it kills its own process)
    run_crash_flow()

    # Verify
    verify_runs()

    print(f"\n{'='*60}")
    print("All three flows have been executed.")
    print(f"Check the UI at http://127.0.0.1:4200 for the flow runs.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
