"""
Prefect pipeline that enforces a global concurrency limit.

Ensures a named global concurrency limit exists with 2 slots, then launches
8 payload flow runs. Each payload flow run must acquire a slot from the limit
before proceeding, ensuring at most 2 run concurrently.

Usage:
    python3 main.py
"""

import asyncio
import time
import traceback
import uuid
from pathlib import Path

from prefect import flow, task, get_client
from prefect.client.schemas.objects import GlobalConcurrencyLimit
from prefect.concurrency.v1.asyncio import concurrency
from prefect.runner import Runner


# ── Configuration ──────────────────────────────────────────────────────────

RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()
LIMIT_NAME = f"throughput-guard-{RUN_ID}"
PAYLOAD_FLOW_NAME = f"payload-unit-{RUN_ID}"
SLOT_LIMIT = 2
UNIT_COUNT = 8
WORK_DURATION = 3  # seconds each unit simulates "work"


# ── Payload task ───────────────────────────────────────────────────────────

@task(name="guarded-work", retries=0)
async def guarded_work(unit_index: int) -> str:
    """
    Acquire a concurrency slot from the global limit, do work, release it.

    The global concurrency limit ensures at most SLOT_LIMIT instances
    of this task run simultaneously across all flow runs.
    """
    from prefect.context import TaskRunContext

    ctx = TaskRunContext.get()
    task_run_id = ctx.task_run.id if ctx else uuid.uuid4()

    print(f"[unit {unit_index}] Attempting to acquire slot from '{LIMIT_NAME}'...")

    start = time.monotonic()
    async with concurrency(LIMIT_NAME, task_run_id=task_run_id):
        acquired_at = time.monotonic()
        wait_time = acquired_at - start
        print(
            f"[unit {unit_index}] Slot acquired after {wait_time:.1f}s. "
            f"Working for {WORK_DURATION}s..."
        )
        await asyncio.sleep(WORK_DURATION)
        print(f"[unit {unit_index}] Work complete. Releasing slot.")

    elapsed = time.monotonic() - start
    return f"unit-{unit_index}: waited {wait_time:.1f}s, total {elapsed:.1f}s"


# ── Payload flow ───────────────────────────────────────────────────────────

@flow(name=PAYLOAD_FLOW_NAME, log_prints=True)
async def payload_unit(unit_index: int = 0):
    """A single unit of work that respects the global concurrency limit."""
    result = await guarded_work(unit_index)
    return result


# ── Orchestrator (main entry point) ────────────────────────────────────────

async def main():
    """Set up the limit, register the flow, launch runs, wait for completion."""

    # ── Step 1: Ensure the global concurrency limit exists ─────────────────
    async with get_client() as client:
        print(f"Ensuring global concurrency limit '{LIMIT_NAME}' with {SLOT_LIMIT} slots...")
        try:
            existing = await client.read_global_concurrency_limit_by_name(LIMIT_NAME)
            print(f"  Limit exists: id={existing.id}, limit={existing.limit}, "
                  f"active_slots={existing.active_slots}")
            if existing.limit != SLOT_LIMIT or not existing.active:
                await client.upsert_global_concurrency_limit_by_name(
                    name=LIMIT_NAME,
                    limit=SLOT_LIMIT,
                )
                print(f"  Updated limit to {SLOT_LIMIT} slots (active).")
        except Exception:
            limit_obj = GlobalConcurrencyLimit(
                name=LIMIT_NAME,
                limit=SLOT_LIMIT,
                active=True,
            )
            await client.create_global_concurrency_limit(limit_obj)
            print(f"  Created new limit with {SLOT_LIMIT} slots.")

        # Verify
        limit = await client.read_global_concurrency_limit_by_name(LIMIT_NAME)
        print(f"  Verified: name={limit.name}, limit={limit.limit}, "
              f"active={limit.active}, active_slots={limit.active_slots}")

    # ── Step 2: Start a Runner to serve the payload flow ───────────────────
    print(f"\nStarting runner for '{PAYLOAD_FLOW_NAME}'...")
    runner = Runner(name=f"runner-{RUN_ID}", pause_on_shutdown=False)

    # Register the payload flow with the runner (creates a deployment)
    # Use the payload flow name as the deployment name so run_deployment can find it
    deployment_id = await runner.aadd_flow(payload_unit, name=PAYLOAD_FLOW_NAME)
    print(f"  Deployment registered: {deployment_id}")

    # Start the runner in a background task
    runner_task = asyncio.create_task(runner.start())

    # Give the runner a moment to start polling
    await asyncio.sleep(3)

    # ── Step 3: Launch all 8 payload flow runs ─────────────────────────────
    print(f"\nLaunching {UNIT_COUNT} payload flow runs via run_deployment...")

    from prefect.deployments.flow_runs import arun_deployment

    deployment_name = f"{PAYLOAD_FLOW_NAME}/{PAYLOAD_FLOW_NAME}"

    tasks = []
    for i in range(UNIT_COUNT):
        t = asyncio.create_task(
            arun_deployment(
                name=deployment_name,
                parameters={"unit_index": i},
                flow_run_name=f"{PAYLOAD_FLOW_NAME}-{i}",
                as_subflow=False,
                timeout=None,  # wait indefinitely for completion
            )
        )
        tasks.append(t)
        # Small stagger to make concurrency behavior observable
        await asyncio.sleep(0.1)

    # Wait for all flow runs to complete
    print(f"Waiting for all {UNIT_COUNT} flow runs to complete...")
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # ── Step 4: Report results ─────────────────────────────────────────────
    print(f"\nAll flow runs finished.")
    failures = 0
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            print(f"  Run {i}: FAILED - {type(r).__name__}: {r}")
            traceback.print_exception(type(r), r, r.__traceback__)
            failures += 1
        else:
            state_type = r.state.type if r.state else "unknown"
            print(f"  Run {i}: COMPLETED - state={state_type}")

    # Stop the runner
    print(f"\nStopping runner...")
    await runner.astop()
    runner_task.cancel()
    try:
        await runner_task
    except asyncio.CancelledError:
        pass

    if failures:
        print(f"\n{failures} flow run(s) failed!")
        raise SystemExit(1)

    print(f"\nAll {UNIT_COUNT} payload units completed successfully.")


if __name__ == "__main__":
    asyncio.run(main())
