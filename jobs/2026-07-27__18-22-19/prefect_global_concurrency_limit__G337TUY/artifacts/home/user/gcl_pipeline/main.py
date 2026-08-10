#!/usr/bin/env python3
"""
Prefect Global Concurrency Limit Enforcement Pipeline.

Ensures a named global concurrency limit exists on the local Prefect server
with exactly 2 slots, then launches 8 independent flow runs that are strictly
bounded by that limit.  At most 2 units execute simultaneously; the rest wait
for capacity.  Every unit completes successfully.

Run:  python3 main.py   (from /home/user/gcl_pipeline)
"""

# ---------------------------------------------------------------------------
# Prefect configuration MUST be set before importing any prefect modules.
# ---------------------------------------------------------------------------
import os

os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"
os.environ.setdefault("PREFECT_SERVER_ALLOW_EPHEMERAL_MODE", "false")

# ---------------------------------------------------------------------------
# Standard-library imports
# ---------------------------------------------------------------------------
import asyncio
import subprocess
import time
import urllib.request

# ---------------------------------------------------------------------------
# Prefect imports (after env vars are configured)
# ---------------------------------------------------------------------------
from prefect import flow
from prefect.concurrency.asyncio import concurrency
from prefect.client.orchestration import get_client
from prefect.client.schemas.actions import GlobalConcurrencyLimitUpdate

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_URL = "http://127.0.0.1:4200/api"
HEALTH_URL = "http://127.0.0.1:4200/api/health"

RUN_ID = open("/logs/artifacts/run-id").read().strip()
LIMIT_NAME = f"throughput-guard-{RUN_ID}"
FLOW_NAME = f"payload-unit-{RUN_ID}"

NUM_UNITS = 8
SLOT_COUNT = 2
WORK_SECONDS = 5.0


# ---------------------------------------------------------------------------
# Server management
# ---------------------------------------------------------------------------
def _server_healthy() -> bool:
    """Return True if the Prefect server responds on the health endpoint."""
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


def _wait_for_server(timeout: float = 120.0) -> bool:
    """Poll the health endpoint until the server is ready or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _server_healthy():
            return True
        time.sleep(1)
    return False


def ensure_server():
    """Start the Prefect server if it is not already running."""
    if _server_healthy():
        print("[server] Prefect server already running at", API_URL)
        return

    print("[server] Starting Prefect server ...")
    subprocess.Popen(
        [
            "prefect", "server", "start",
            "--host", "127.0.0.1",
            "--port", "4200",
            "--analytics-off",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,  # detach so it survives parent exit
    )

    if not _wait_for_server():
        raise RuntimeError("Prefect server did not become healthy in time")
    print("[server] Prefect server is healthy at", API_URL)


# ---------------------------------------------------------------------------
# Concurrency-limit management
# ---------------------------------------------------------------------------
async def ensure_limit():
    """Ensure the global concurrency limit exists, is active, and has 2 slots."""
    async with get_client() as client:
        # Create-or-update the limit (sets limit=2; active defaults to True
        # on creation, but upsert does not touch `active` on update).
        await client.upsert_global_concurrency_limit_by_name(
            name=LIMIT_NAME,
            limit=SLOT_COUNT,
        )

        # Explicitly ensure the limit is active (covers the case where a
        # pre-existing limit was deactivated).
        existing = await client.read_global_concurrency_limit_by_name(LIMIT_NAME)
        if not existing.active:
            await client.update_global_concurrency_limit(
                LIMIT_NAME,
                GlobalConcurrencyLimitUpdate(active=True, limit=SLOT_COUNT),
            )

        # Verify final state.
        limit = await client.read_global_concurrency_limit_by_name(LIMIT_NAME)
        print(
            f"[limit] '{LIMIT_NAME}' -> slots={limit.limit}, "
            f"active={limit.active}, active_slots={limit.active_slots}"
        )
        assert limit.limit == SLOT_COUNT, f"Expected {SLOT_COUNT} slots, got {limit.limit}"
        assert limit.active, "Limit is not active"


# ---------------------------------------------------------------------------
# Payload flow — each call is an independent flow run
# ---------------------------------------------------------------------------
@flow(name=FLOW_NAME)
async def payload_unit(unit_id: int):
    """
    A single unit of work.

    Acquires one slot of the named global concurrency limit for the entire
    duration of its work.  If no slot is available the call blocks (waits)
    until one frees up.  With strict=True the call would raise if the limit
    did not exist, but we created it beforehand so this guarantees real
    server-side enforcement.
    """
    async with concurrency(LIMIT_NAME, occupy=1, strict=True):
        # --- critical section: at most SLOT_COUNT units run this at once ---
        await asyncio.sleep(WORK_SECONDS)
    return f"unit-{unit_id} complete"


# ---------------------------------------------------------------------------
# Pipeline entry-point
# ---------------------------------------------------------------------------
async def main():
    # 1. Ensure the concurrency limit exists on the server.
    await ensure_limit()

    # 2. Launch all 8 units concurrently.  Each becomes its own independent
    #    root flow run named payload-unit-<run-id>.  The server-side limit
    #    ensures at most 2 execute their critical section at the same time;
    #    the rest wait for a slot to free up.
    print(f"[pipeline] Launching {NUM_UNITS} units (limit={SLOT_COUNT} slots) ...")
    coros = [payload_unit(i) for i in range(NUM_UNITS)]
    results = await asyncio.gather(*coros)

    for r in results:
        print(f"  {r}")
    print(f"[pipeline] All {len(results)} units completed successfully.")


# ---------------------------------------------------------------------------
# Script entry
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ensure_server()
    asyncio.run(main())