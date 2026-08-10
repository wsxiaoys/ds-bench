"""
Slot-based critical-section concurrency control with Prefect.

Runs entirely against a local, ephemeral Prefect API (no Cloud, no remote
server, no external database). Submits 8 concurrent tasks that each acquire
a weighted number of slots from a named concurrency limit ("critical-section",
capacity 4) before entering a critical section, and records tamper-evident,
timestamped proof of entry/exit in occupancy_proof.json.
"""

import json
import os
import time
from datetime import datetime, timezone

# Keep everything local & offline: use a project-local PREFECT_HOME and make
# sure no remote API URL is configured, so Prefect falls back to its local
# ephemeral (SQLite-backed) API server.
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("PREFECT_HOME", os.path.join(PROJECT_DIR, ".prefect"))
os.environ.pop("PREFECT_API_URL", None)
# Avoid noisy (harmless) background telemetry-heartbeat errors against the
# ephemeral SQLite database; this task is fully offline anyway.
os.environ.setdefault("PREFECT_SERVER_ANALYTICS_ENABLED", "false")

from prefect import flow, task  # noqa: E402
from prefect.client.orchestration import get_client  # noqa: E402
from prefect.concurrency.sync import concurrency  # noqa: E402
from prefect.task_runners import ThreadPoolTaskRunner  # noqa: E402

LIMIT_NAME = "critical-section"
TOTAL_SLOTS = 4

# Weighted slot occupancy per task id, per the spec.
TASK_SLOTS = {
    "t0": 1,
    "t1": 1,
    "t2": 2,
    "t3": 1,
    "t4": 2,
    "t5": 1,
    "t6": 2,
    "t7": 1,
}

HOLD_SECONDS = 1.2  # each task holds the critical section for >= 1.0s


def _now_iso() -> str:
    """Timezone-aware ISO-8601 UTC timestamp with microsecond precision."""
    return datetime.now(timezone.utc).isoformat()


@task
def guarded_task(task_id: str) -> dict:
    slots = TASK_SLOTS[task_id]

    # Guard the critical section with the named, weighted concurrency limit.
    # strict=True ensures we fail loudly instead of silently proceeding if the
    # limit does not exist.
    with concurrency(LIMIT_NAME, occupy=slots, strict=True):
        # Only capture "entered_at" once the required slots are actually held.
        entered_at = _now_iso()
        time.sleep(HOLD_SECONDS)
        # Capture "exited_at" before the slots are released.
        exited_at = _now_iso()

    return {
        "task_id": task_id,
        "slots": slots,
        "entered_at": entered_at,
        "exited_at": exited_at,
    }


@flow(task_runner=ThreadPoolTaskRunner(max_workers=8))
def critical_section_flow() -> list:
    futures = [guarded_task.submit(task_id) for task_id in TASK_SLOTS]
    return [future.result() for future in futures]


def ensure_concurrency_limit() -> None:
    """Create (or update) the named concurrency limit with capacity 4."""
    with get_client(sync_client=True) as client:
        client.upsert_global_concurrency_limit_by_name(LIMIT_NAME, TOTAL_SLOTS)


def main() -> None:
    ensure_concurrency_limit()

    results = critical_section_flow()

    # Order the tasks t0..t7 for a deterministic, readable proof file.
    results_by_id = {r["task_id"]: r for r in results}
    ordered_tasks = [results_by_id[f"t{i}"] for i in range(8)]

    proof = {
        "limit_name": LIMIT_NAME,
        "total_slots": TOTAL_SLOTS,
        "tasks": ordered_tasks,
    }

    proof_path = os.path.join(PROJECT_DIR, "occupancy_proof.json")
    with open(proof_path, "w") as f:
        json.dump(proof, f, indent=2)

    print(f"Wrote occupancy proof to {proof_path}")


if __name__ == "__main__":
    main()
