"""
Prefect flows that demonstrate three distinct terminal states:
- TimedOut: Flow exceeds its maximum runtime
- Crashed: Flow process is terminated by infrastructure (BaseException)
- Failed: Flow raises a regular Python exception
"""

import time
import os
import signal
from prefect import flow, task

RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id() -> str:
    with open(RUN_ID_FILE) as f:
        return f.read().strip()


RUN_ID = _read_run_id()


# ── TimedOut Flow ────────────────────────────────────────────────────────────
# This flow has a 5-second timeout but sleeps for 10 seconds.
# Prefect will abort it, producing a Failed state with name="TimedOut".

@flow(
    name=f"timeout-flow-{RUN_ID}",
    timeout_seconds=5,
    log_prints=True,
)
def timeout_flow():
    print(f"[timeout-flow-{RUN_ID}] Starting work that will exceed the 5s timeout...")
    time.sleep(10)
    print("This line should never be reached.")


# ── Crashed Flow ─────────────────────────────────────────────────────────────
# This flow raises SystemExit (a BaseException, not Exception), which Prefect
# treats as an infrastructure-level crash → state type CRASHED.

@flow(
    name=f"crash-flow-{RUN_ID}",
    log_prints=True,
)
def crash_flow():
    print(f"[crash-flow-{RUN_ID}] Simulating infrastructure crash via SystemExit...")
    # SystemExit is a BaseException (not Exception), so Prefect handles it as a crash.
    raise SystemExit(1)


# ── Failed Flow ──────────────────────────────────────────────────────────────
# This flow raises a regular Python exception → state type FAILED.

@flow(
    name=f"failure-flow-{RUN_ID}",
    log_prints=True,
)
def failure_flow():
    print(f"[failure-flow-{RUN_ID}] Raising a deliberate exception...")
    raise ValueError("Deliberate flow failure for demonstration purposes.")
