#!/usr/bin/env python3
"""Executable entrypoint that runs all three flows against the local
Prefect OSS server and verifies each flow run landed in its required
terminal state.

    timeout-flow-<run-id>  -> TimedOut
    crash-flow-<run-id>    -> Crashed
    failure-flow-<run-id>  -> Failed

Usage:
    cd /home/user/flow_states && python3 run_all.py
"""

import os
import signal
import subprocess
import sys
import time

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_DIR)

os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4200/api")

from flows.common import (  # noqa: E402
    CRASH_FLOW_NAME,
    FAILURE_FLOW_NAME,
    RUN_ID,
    TIMEOUT_FLOW_NAME,
)


def _subprocess_env() -> dict:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    return env


def run_failure_flow() -> None:
    """Run failure-flow-<run-id> to completion. It raises an ordinary
    exception, so the subprocess is expected to exit non-zero -- the flow
    run itself is still recorded on the server as Failed before the
    exception propagates."""
    print(f"\n=== Running {FAILURE_FLOW_NAME} (expected terminal state: Failed) ===")
    result = subprocess.run(
        [sys.executable, "-m", "flows.failure_flow"],
        cwd=PROJECT_DIR,
        env=_subprocess_env(),
    )
    print(f"[run_all] {FAILURE_FLOW_NAME} subprocess exited with code {result.returncode} "
          f"(non-zero is expected: the flow raises).")


def run_timeout_flow() -> None:
    """Run timeout-flow-<run-id> to completion. Prefect enforces the 5s
    timeout itself and reports TimedOut to the server; the subprocess is
    expected to exit non-zero once the timeout error propagates."""
    print(f"\n=== Running {TIMEOUT_FLOW_NAME} (expected terminal state: TimedOut) ===")
    result = subprocess.run(
        [sys.executable, "-m", "flows.timeout_flow"],
        cwd=PROJECT_DIR,
        env=_subprocess_env(),
    )
    print(f"[run_all] {TIMEOUT_FLOW_NAME} subprocess exited with code {result.returncode} "
          f"(non-zero is expected: the run is aborted by the engine's timeout).")


def run_crash_flow() -> None:
    """Run crash-flow-<run-id> in a subprocess, then deliver a real SIGTERM
    to that OS process (a genuine infrastructure-level interruption) once
    the flow run has actually started. Prefect's engine converts the
    SIGTERM into a Crashed state, reports it to the server, and then the
    process is terminated."""
    print(f"\n=== Running {CRASH_FLOW_NAME} (expected terminal state: Crashed) ===")
    proc = subprocess.Popen(
        [sys.executable, "-u", "-m", "flows.crash_flow"],
        cwd=PROJECT_DIR,
        env=_subprocess_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    ready_marker = "CRASH_FLOW_READY_FOR_SIGTERM"
    saw_ready = False
    deadline = time.monotonic() + 60
    assert proc.stdout is not None
    for line in proc.stdout:
        print(f"[crash-flow output] {line}", end="")
        if ready_marker in line:
            saw_ready = True
            break
        if time.monotonic() > deadline:
            break

    if not saw_ready:
        print(
            "[run_all] WARNING: never saw the crash-flow ready marker; "
            "sending SIGTERM anyway."
        )

    # Give the engine's signal handler a brief moment to be fully installed
    # and the flow run's Running state to be persisted server-side.
    time.sleep(1.5)

    print(
        f"[run_all] Sending SIGTERM to crash-flow subprocess (pid={proc.pid}) "
        "to simulate an infrastructure-level crash..."
    )
    proc.send_signal(signal.SIGTERM)

    # Drain any remaining output.
    try:
        for line in proc.stdout:
            print(f"[crash-flow output] {line}", end="")
    except Exception:
        pass

    try:
        returncode = proc.wait(timeout=30)
    except subprocess.TimeoutExpired:
        print("[run_all] crash-flow subprocess did not exit in time; killing it.")
        proc.kill()
        returncode = proc.wait(timeout=10)

    print(f"[run_all] {CRASH_FLOW_NAME} subprocess exited with code {returncode} "
          f"(terminated by SIGTERM, as expected).")


def verify_terminal_states() -> bool:
    """Query the local Prefect server for the latest run of each flow and
    confirm each landed in its required terminal state."""
    from prefect.client.orchestration import get_client
    from prefect.client.schemas.filters import FlowRunFilter, FlowRunFilterName
    from prefect.client.schemas.sorting import FlowRunSort

    expected = {
        TIMEOUT_FLOW_NAME: "TimedOut",
        CRASH_FLOW_NAME: "Crashed",
        FAILURE_FLOW_NAME: "Failed",
    }

    print("\n=== Verifying terminal states on the local Prefect server ===")
    all_ok = True
    client = get_client(sync_client=True)
    with client:
        for flow_name, expected_state_name in expected.items():
            runs = client.read_flow_runs(
                flow_run_filter=FlowRunFilter(name=FlowRunFilterName(any_=[flow_name])),
                sort=FlowRunSort.START_TIME_DESC,
                limit=1,
            )
            if not runs:
                print(f"[verify] {flow_name}: NO FLOW RUN FOUND on the server!")
                all_ok = False
                continue

            run = runs[0]
            state = run.state
            state_type = state.type.value if state else None
            state_name = state.name if state else None
            status = "OK" if state_name == expected_state_name else "MISMATCH"
            if status == "MISMATCH":
                all_ok = False
            print(
                f"[verify] {flow_name}: flow_run_id={run.id} "
                f"state_type={state_type} state_name={state_name!r} "
                f"(expected {expected_state_name!r}) -> {status}"
            )
            print(
                f"          UI: http://127.0.0.1:4200/flow-runs/flow-run/{run.id}"
            )

    return all_ok


def main() -> None:
    print(f"Run ID: {RUN_ID}")
    print("Flows to execute:")
    print(f"  - {TIMEOUT_FLOW_NAME}  -> TimedOut")
    print(f"  - {CRASH_FLOW_NAME}    -> Crashed")
    print(f"  - {FAILURE_FLOW_NAME}  -> Failed")

    # Run each flow. Order doesn't matter functionally, but we run the
    # simplest ones first and the signal-based crash last.
    run_failure_flow()
    run_timeout_flow()
    run_crash_flow()

    ok = verify_terminal_states()

    print(f"\n=== Flow Runs page: http://127.0.0.1:4200/runs ===")

    if not ok:
        print(
            "\n[run_all] One or more flow runs did NOT land in their required "
            "terminal state. Re-run this script to retry."
        )
        sys.exit(1)

    print("\n[run_all] All three flow runs landed in their required terminal states.")


if __name__ == "__main__":
    main()
