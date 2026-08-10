"""Batch pipeline that throttles fan-out work with a Prefect global
concurrency limit ("render-pool").

Run with:  python3 pipeline.py

This script is a *pure consumer* of the "render-pool" global concurrency
limit: it never creates, updates, deletes, enables/disables, or otherwise
mutates the limit. The limit must already exist on the Prefect
(local/ephemeral) API server before this script is run, e.g.:

    prefect gcl create render-pool --limit 3

If the limit does not exist, this script exits with a non-zero status
without running the batch.

Each of the 12 work units (ids 0-11) acquires exactly one slot on the
"render-pool" limit, holds it for at least 1.0 second while "working", and
then releases it. The number of units simultaneously holding a slot never
exceeds the limit's *current* server-side value (read dynamically at
acquire time by Prefect itself), and, under contention, reaches that value.

Every acquire/release event is appended to occupancy.jsonl (overwritten at
the start of each run) as a single JSON object per line:

    {"event": "acquire" | "release", "unit": <int 0-11>, "ts": <float>}

Writes to the log are serialized with a lock so concurrent threads never
interleave or corrupt lines.
"""

from __future__ import annotations

import json
import sys
import threading
import time
from pathlib import Path

from prefect import flow, get_run_logger, task
from prefect.client.orchestration import get_client
from prefect.concurrency.sync import concurrency
from prefect.exceptions import ObjectNotFound
from prefect.task_runners import ThreadPoolTaskRunner

LIMIT_NAME = "render-pool"
NUM_UNITS = 12
MIN_HOLD_SECONDS = 1.0

PROJECT_DIR = Path(__file__).resolve().parent
OCCUPANCY_LOG_PATH = PROJECT_DIR / "occupancy.jsonl"

# Guards writes to the occupancy log so lines from concurrent threads never
# interleave/corrupt each other.
_log_lock = threading.Lock()


def _reset_occupancy_log() -> None:
    """Overwrite the occupancy log so it reflects only this run."""
    OCCUPANCY_LOG_PATH.write_text("")


def _write_event(event: str, unit: int) -> None:
    record = {"event": event, "unit": unit, "ts": time.time()}
    line = json.dumps(record)
    with _log_lock:
        with open(OCCUPANCY_LOG_PATH, "a") as fh:
            fh.write(line + "\n")
            fh.flush()


def _ensure_limit_exists() -> None:
    """Fail fast (non-zero exit) if the render-pool limit hasn't been
    created yet. This check happens *before* any work unit is submitted so
    the batch never runs unthrottled."""
    client = get_client(sync_client=True)
    try:
        client.read_global_concurrency_limit_by_name(LIMIT_NAME)
    except ObjectNotFound:
        print(
            f"ERROR: global concurrency limit {LIMIT_NAME!r} does not exist.\n"
            f"Create it first, e.g.:\n"
            f"    prefect gcl create {LIMIT_NAME} --limit 3",
            file=sys.stderr,
        )
        sys.exit(1)


@task
def process_unit(unit: int) -> int:
    logger = get_run_logger()
    # `strict=True` makes Prefect raise instead of silently creating the
    # limit if it happens to vanish between the startup check and now, so
    # this task can never run unthrottled.
    with concurrency(LIMIT_NAME, occupy=1, strict=True):
        _write_event("acquire", unit)
        logger.info("unit %s acquired a slot on %r", unit, LIMIT_NAME)
        time.sleep(MIN_HOLD_SECONDS)
    # The slot is released as the `with` block above exits; log the
    # release event immediately afterwards.
    _write_event("release", unit)
    logger.info("unit %s released its slot on %r", unit, LIMIT_NAME)
    return unit


@flow(task_runner=ThreadPoolTaskRunner(max_workers=NUM_UNITS))
def render_batch() -> list[int]:
    futures = [process_unit.submit(unit) for unit in range(NUM_UNITS)]
    return [future.result() for future in futures]


def main() -> None:
    _reset_occupancy_log()
    _ensure_limit_exists()

    results = render_batch()

    if sorted(results) != list(range(NUM_UNITS)):
        print(f"ERROR: expected all {NUM_UNITS} units to complete, got {results}", file=sys.stderr)
        sys.exit(1)

    print(f"All {NUM_UNITS} units completed. Occupancy log: {OCCUPANCY_LOG_PATH}")


if __name__ == "__main__":
    main()
