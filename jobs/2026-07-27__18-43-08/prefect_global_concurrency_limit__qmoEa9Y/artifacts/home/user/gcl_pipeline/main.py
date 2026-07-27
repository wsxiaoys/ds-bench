"""
Prefect Global Concurrency Limit Enforcement pipeline.

This script, when run once (`python3 main.py`):
  1. Ensures a named, server-side global concurrency limit exists on the
     local Prefect server (http://127.0.0.1:4200/api) with exactly 2 slots.
  2. Launches 8 independent flow runs of a flow named
     `payload-unit-<run-id>`, all "at once" (concurrently), where each
     flow run must acquire one slot of the global concurrency limit
     before doing its work and holds that slot for the entire duration
     of the work, releasing it only when the work is done.
  3. Waits for all 8 flow runs to complete successfully before exiting,
     so that after this script returns the Prefect UI shows the limit
     (with its 2 slots) and all 8 flow runs in the Completed state.

The concurrency limit is enforced by the Prefect server itself (via the
global concurrency limits / slot-leasing API), not by any in-process
semaphore, so it strictly bounds how many units of work run at the same
time regardless of how many are launched concurrently.
"""

import asyncio
from pathlib import Path

from prefect import flow, get_run_logger
from prefect.client.orchestration import get_client
from prefect.concurrency.asyncio import concurrency

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RUN_ID_PATH = Path("/logs/artifacts/run-id")
NUM_UNITS = 8
SLOTS = 2
WORK_SECONDS = 4


def read_run_id() -> str:
    """Read the collision-avoidance run-id used to make resource names unique."""
    return RUN_ID_PATH.read_text().strip()


RUN_ID = read_run_id()
LIMIT_NAME = f"throughput-guard-{RUN_ID}"
FLOW_NAME = f"payload-unit-{RUN_ID}"


# ---------------------------------------------------------------------------
# Global concurrency limit setup
# ---------------------------------------------------------------------------


async def ensure_concurrency_limit() -> None:
    """Ensure the named global concurrency limit exists on the local server
    with exactly SLOTS slots and is active. Idempotent: safe to call every
    run of this script."""
    async with get_client() as client:
        await client.upsert_global_concurrency_limit_by_name(
            name=LIMIT_NAME,
            limit=SLOTS,
        )
        # `upsert_global_concurrency_limit_by_name` only touches `limit`
        # (and slot_decay_per_second). Explicitly make sure the limit is
        # active, in case a stale/disabled limit with this name existed.
        existing = await client.read_global_concurrency_limit_by_name(LIMIT_NAME)
        if not existing.active:
            from prefect.client.schemas.actions import GlobalConcurrencyLimitUpdate

            await client.update_global_concurrency_limit(
                LIMIT_NAME, GlobalConcurrencyLimitUpdate(active=True)
            )


# ---------------------------------------------------------------------------
# The unit-of-work flow
#
# Each call to `payload_unit(...)` below is made directly (not from within
# another @flow), so every call creates its own independent, top-level flow
# run in the Prefect server -- exactly 8 of them, all named `FLOW_NAME`.
# ---------------------------------------------------------------------------


@flow(name=FLOW_NAME, log_prints=True)
async def payload_unit(unit_id: int) -> int:
    logger = get_run_logger()
    logger.info(
        "Unit %s waiting to acquire a slot on global concurrency limit %r",
        unit_id,
        LIMIT_NAME,
    )
    # Occupy exactly one slot of the named, server-enforced global
    # concurrency limit for the entire duration of this unit's work.
    # `timeout_seconds=None` (the default) means this waits indefinitely
    # for capacity rather than erroring out.
    async with concurrency(LIMIT_NAME, occupy=1):
        logger.info("Unit %s acquired a slot, starting work", unit_id)
        await asyncio.sleep(WORK_SECONDS)
        logger.info("Unit %s finished work, releasing its slot", unit_id)

    return unit_id


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


async def main() -> None:
    print(f"Using run-id: {RUN_ID}")
    print(f"Ensuring global concurrency limit '{LIMIT_NAME}' with {SLOTS} slots...")
    await ensure_concurrency_limit()
    print(f"Global concurrency limit '{LIMIT_NAME}' is ready.")

    print(f"Launching {NUM_UNITS} concurrent '{FLOW_NAME}' flow runs...")
    # Launch all units "at once": create all the coroutine objects first and
    # drive them concurrently with asyncio.gather. Each coroutine is an
    # independent call to the `payload_unit` flow, so each becomes its own
    # top-level flow run. Only `SLOTS` of them will actually be executing
    # their work at any given moment, because the rest will be blocked
    # inside the `concurrency(...)` context manager waiting on the
    # server-side global concurrency limit.
    results = await asyncio.gather(
        *(payload_unit(unit_id) for unit_id in range(1, NUM_UNITS + 1))
    )

    print(f"All {len(results)} units completed successfully: {sorted(results)}")


if __name__ == "__main__":
    asyncio.run(main())
