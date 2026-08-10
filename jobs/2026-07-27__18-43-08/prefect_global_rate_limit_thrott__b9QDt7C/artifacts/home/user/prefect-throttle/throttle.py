#!/usr/bin/env python3
"""
Rerunnable entrypoint that:
  (a) ensures a rate-limiting global concurrency limit ("throughput-control
      resource") exists on a local, self-hosted Prefect server with an exact
      permit ceiling and per-second replenishment rate, and
  (b) dispatches a fixed number of throttled work units (flow runs) through
      that resource, driving every one of them to a `Completed` state.

Run with:  python3 throttle.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

PROJECT_DIR = Path(__file__).resolve().parent
PREFECT_HOME = PROJECT_DIR / ".prefect_home"
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 4200
API_URL = f"http://{SERVER_HOST}:{SERVER_PORT}/api"
HEALTH_URL = f"{API_URL}/health"

RUN_ID_PATH = Path("/logs/artifacts/run-id")


def _read_run_id() -> str:
    """Read the trial identifier exactly, unmodified (aside from the trailing
    newline that terminates the file)."""
    if RUN_ID_PATH.exists():
        return RUN_ID_PATH.read_text().splitlines()[0]
    # Fallback for local testing outside of the grading sandbox.
    return "local"


RUN_ID = _read_run_id()

RESOURCE_NAME = f"partner-api-throttle-{RUN_ID}"
FLOW_NAME = f"throttled-dispatch-{RUN_ID}"

PERMIT_CEILING = 4
REPLENISH_RATE_PER_SECOND = 1.5
WORK_UNIT_COUNT = 12

# Ensure every Prefect client/server component used by this process (and any
# subprocess we spawn) points at the same local, loopback-only server.
os.environ["PREFECT_HOME"] = str(PREFECT_HOME)
os.environ["PREFECT_API_URL"] = API_URL
os.environ["PREFECT_SERVER_API_HOST"] = SERVER_HOST
os.environ["PREFECT_SERVER_API_PORT"] = str(SERVER_PORT)
# We manage a real, persistent local server ourselves -- disable the
# in-process ephemeral fallback so calls always go over HTTP to 127.0.0.1.
os.environ["PREFECT_SERVER_ALLOW_EPHEMERAL_MODE"] = "false"

import httpx  # noqa: E402  (import after env vars are set)
from prefect import flow  # noqa: E402
from prefect.client.orchestration import get_client  # noqa: E402
from prefect.client.schemas.actions import (  # noqa: E402
    GlobalConcurrencyLimitCreate,
    GlobalConcurrencyLimitUpdate,
)
from prefect.exceptions import ObjectNotFound  # noqa: E402


# --------------------------------------------------------------------------
# 1. Ensure a local Prefect server is running on 127.0.0.1:4200
# --------------------------------------------------------------------------


def _server_is_up() -> bool:
    try:
        resp = httpx.get(HEALTH_URL, timeout=2.0)
        return resp.status_code == 200
    except Exception:
        return False


def ensure_local_server() -> None:
    if _server_is_up():
        print(f"Prefect server already reachable at {API_URL}")
        return

    print(f"Starting local Prefect server on {SERVER_HOST}:{SERVER_PORT} ...")
    PREFECT_HOME.mkdir(parents=True, exist_ok=True)
    log_path = PREFECT_HOME / "server.log"
    log_file = open(log_path, "a")

    subprocess.Popen(
        [
            sys.executable,
            "-m",
            "prefect",
            "server",
            "start",
            "--host",
            SERVER_HOST,
            "--port",
            str(SERVER_PORT),
        ],
        stdout=log_file,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,
        env=os.environ.copy(),
        cwd=str(PROJECT_DIR),
    )

    deadline = time.time() + 90
    while time.time() < deadline:
        if _server_is_up():
            print(f"Prefect server is up at {API_URL} (log: {log_path})")
            return
        time.sleep(1)

    raise RuntimeError(
        f"Local Prefect server did not become healthy within timeout. "
        f"See {log_path} for details."
    )


# --------------------------------------------------------------------------
# 2. Ensure the throughput-control (rate-limiting) resource exists with the
#    exact required configuration. Safe to call repeatedly.
# --------------------------------------------------------------------------


async def _ensure_resource_async() -> None:
    async with get_client() as client:
        try:
            existing = await client.read_global_concurrency_limit_by_name(
                RESOURCE_NAME
            )
        except ObjectNotFound:
            existing = None

        if existing is None:
            await client.create_global_concurrency_limit(
                GlobalConcurrencyLimitCreate(
                    name=RESOURCE_NAME,
                    limit=PERMIT_CEILING,
                    active=True,
                    active_slots=0,
                    slot_decay_per_second=REPLENISH_RATE_PER_SECOND,
                )
            )
            print(
                f"Created throughput-control resource '{RESOURCE_NAME}' "
                f"(limit={PERMIT_CEILING}, decay/sec={REPLENISH_RATE_PER_SECOND})"
            )
        else:
            needs_update = (
                existing.limit != PERMIT_CEILING
                or existing.slot_decay_per_second != REPLENISH_RATE_PER_SECOND
                or existing.active is not True
            )
            if needs_update:
                await client.update_global_concurrency_limit(
                    RESOURCE_NAME,
                    GlobalConcurrencyLimitUpdate(
                        limit=PERMIT_CEILING,
                        active=True,
                        slot_decay_per_second=REPLENISH_RATE_PER_SECOND,
                    ),
                )
                print(f"Updated existing throughput-control resource '{RESOURCE_NAME}'")
            else:
                print(
                    f"Throughput-control resource '{RESOURCE_NAME}' already "
                    f"exists with the required configuration"
                )


def ensure_resource() -> None:
    from prefect.utilities.asyncutils import run_coro_as_sync

    run_coro_as_sync(_ensure_resource_async())


# --------------------------------------------------------------------------
# 3. The flow: one identical unit of work, paced through the
#    throughput-control resource before executing.
# --------------------------------------------------------------------------


@flow(name=FLOW_NAME, log_prints=True)
def throttled_dispatch(unit_index: int) -> int:
    from prefect.concurrency.sync import rate_limit

    # Block until a permit for this named throughput-control resource is
    # available. Permits are consumed here and regenerate gradually at
    # REPLENISH_RATE_PER_SECOND, per the resource's decay configuration --
    # this is what paces/throttles the batch over time rather than merely
    # capping simultaneous holders.
    rate_limit(RESOURCE_NAME)

    print(f"Unit {unit_index}/{WORK_UNIT_COUNT} passed the partner-api throttle")
    # The identical "unit of work" performed once a permit has been granted.
    time.sleep(0.1)
    return unit_index


# --------------------------------------------------------------------------
# 4. Dispatch the fixed batch of work units and confirm all complete.
# --------------------------------------------------------------------------


def dispatch_batch() -> None:
    print(
        f"Dispatching {WORK_UNIT_COUNT} throttled work units through "
        f"flow '{FLOW_NAME}' via resource '{RESOURCE_NAME}' ..."
    )

    results: dict[int, str] = {}

    def _run(i: int) -> tuple[int, str]:
        state = throttled_dispatch(i, return_state=True)
        return i, state.name

    # Dispatch concurrently so the fixed permit ceiling + gradual
    # replenishment actually spreads (throttles) the batch out over time,
    # instead of trivially serializing it ourselves.
    with ThreadPoolExecutor(max_workers=WORK_UNIT_COUNT) as pool:
        futures = [pool.submit(_run, i) for i in range(1, WORK_UNIT_COUNT + 1)]
        for future in as_completed(futures):
            i, state_name = future.result()
            results[i] = state_name

    completed = sum(1 for s in results.values() if s == "Completed")
    print(f"{completed}/{WORK_UNIT_COUNT} flow runs reached Completed")

    if completed != WORK_UNIT_COUNT:
        failures = {i: s for i, s in results.items() if s != "Completed"}
        raise RuntimeError(f"Not all work units completed successfully: {failures}")


def main() -> None:
    ensure_local_server()
    ensure_resource()
    dispatch_batch()
    print("Done.")
    print(f"UI: http://{SERVER_HOST}:{SERVER_PORT}")
    print(f"  Concurrency view resource: {RESOURCE_NAME}")
    print(f"  Flow runs view flow:       {FLOW_NAME}")


if __name__ == "__main__":
    main()
