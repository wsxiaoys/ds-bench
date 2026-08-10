"""
Guarded pipeline that combines two *different* Prefect concurrency mechanisms
to safely serialize access to a shared "hot" resource while independently
capping overall pipeline parallelism.

Mechanism #1 -- Task-run tag concurrency limit
    The critical section that touches the hot resource is a `@task` tagged
    with `hotpath-<run-id>`. A task-run concurrency limit of 1 is registered
    against that tag on the server (see setup_concurrency.py), so Prefect's
    orchestration engine guarantees that no more than one task run carrying
    that tag is ever in a `Running` state at the same time, regardless of how
    many flow runs are executing concurrently.

Mechanism #2 -- Global concurrency limit (slots)
    The broader processing step acquires a slot from the independently named
    global concurrency limit `throughput-<run-id>` (exactly 3 slots) using the
    `prefect.concurrency.asyncio.concurrency` async context manager. This caps
    how many units may be doing "broad" work at once, independent of the tag
    based limit above.

Together: the hot resource is strictly serialized (limit of 1 via tag) while
overall throughput is capped at 3 concurrent units (via the global slot
limit) -- two independent controls, enforced simultaneously.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

# Defensive fallback: this local server has CSRF protection disabled, but the
# default client will still probe the (non-functional) CSRF token endpoint
# unless client-side CSRF support is turned off. This is also persisted in
# the active Prefect profile (~/.prefect/profiles.toml), but we set it here
# too so this module is self-contained regardless of the invoking shell/env.
os.environ.setdefault("PREFECT_CLIENT_CSRF_SUPPORT_ENABLED", "False")

from prefect import flow, task
from prefect.concurrency.asyncio import concurrency as global_concurrency
from prefect.logging import get_run_logger

RUN_ID_PATH = Path("/logs/artifacts/run-id")


def _read_run_id() -> str:
    return RUN_ID_PATH.read_text().strip()


RUN_ID = _read_run_id()

# Exact names required by the task, both suffixed with the run-id.
HOT_TAG = f"hotpath-{RUN_ID}"
THROUGHPUT_LIMIT_NAME = f"throughput-{RUN_ID}"
FLOW_NAME = f"guarded_pipeline_{RUN_ID}"

TOTAL_UNITS = 12


@task(name="touch-hot-resource", tags=[HOT_TAG])
async def critical_section(unit_id: int) -> str:
    """
    The strictly-serialized critical section. Only one task run carrying the
    `hotpath-<run-id>` tag may be Running at any given moment, enforced by
    the task-run concurrency limit registered against that tag.
    """
    logger = get_run_logger()
    logger.info(f"[unit {unit_id}] ENTER critical section (tag={HOT_TAG})")
    # Simulate work against the shared hot resource.
    await asyncio.sleep(0.25)
    logger.info(f"[unit {unit_id}] EXIT critical section (tag={HOT_TAG})")
    return f"unit-{unit_id}-hot-resource-touched"


@task(name="broad-processing")
async def broader_processing(unit_id: int) -> str:
    """
    Broader, non-exclusive processing whose overall parallelism is capped by
    the independently-named global concurrency limit `throughput-<run-id>`
    (3 slots), regardless of the tag-based limit above.
    """
    logger = get_run_logger()
    async with global_concurrency(THROUGHPUT_LIMIT_NAME, occupy=1):
        logger.info(
            f"[unit {unit_id}] ACQUIRED slot on global concurrency limit "
            f"'{THROUGHPUT_LIMIT_NAME}'"
        )
        await asyncio.sleep(0.5)
        logger.info(
            f"[unit {unit_id}] RELEASING slot on global concurrency limit "
            f"'{THROUGHPUT_LIMIT_NAME}'"
        )
    return f"unit-{unit_id}-processing-done"


@flow(name=FLOW_NAME, log_prints=True)
async def guarded_pipeline(unit_id: int) -> dict:
    """
    One unit of work: serialize the hot-resource critical section via the
    tag concurrency limit, then perform broader processing bounded by the
    global concurrency limit.
    """
    print(f"Starting unit {unit_id} of flow '{FLOW_NAME}' (run-id={RUN_ID})")
    critical_result = await critical_section(unit_id)
    processing_result = await broader_processing(unit_id)
    print(f"Completed unit {unit_id}")
    return {
        "unit_id": unit_id,
        "critical": critical_result,
        "processing": processing_result,
    }


async def run_all_units(total_units: int = TOTAL_UNITS) -> list[dict]:
    """Launch `total_units` concurrent units of guarded_pipeline at once."""
    results = await asyncio.gather(
        *(guarded_pipeline(unit_id) for unit_id in range(total_units))
    )
    return list(results)
