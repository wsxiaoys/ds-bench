"""
One-time (idempotent) setup script that registers, on the local Prefect
server, the two independent concurrency controls used by the guarded
pipeline:

  1. A task-run concurrency limit of exactly 1 on the tag `hotpath-<run-id>`
     -- serializes the hot-resource critical section.
  2. A global concurrency limit named `throughput-<run-id>` with exactly 3
     slots -- caps overall pipeline parallelism.

This script is intentionally separate from run.py: the two controls must be
created and persisted on the server independently of executing the
workload. Run this once before invoking `python3 run.py`.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

os.environ.setdefault("PREFECT_CLIENT_CSRF_SUPPORT_ENABLED", "False")

from prefect.client.orchestration import get_client

RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()

HOT_TAG = f"hotpath-{RUN_ID}"
TAG_CONCURRENCY_LIMIT = 1

THROUGHPUT_LIMIT_NAME = f"throughput-{RUN_ID}"
THROUGHPUT_SLOTS = 3


async def ensure_tag_concurrency_limit() -> None:
    async with get_client() as client:
        try:
            existing = await client.read_concurrency_limit_by_tag(tag=HOT_TAG)
        except Exception:
            existing = None

        if existing is not None:
            print(
                f"Task-run concurrency limit for tag '{HOT_TAG}' already "
                f"exists (limit={existing.concurrency_limit}); skipping create."
            )
            return
        await client.create_concurrency_limit(
            tag=HOT_TAG, concurrency_limit=TAG_CONCURRENCY_LIMIT
        )
        print(
            f"Created task-run concurrency limit: tag='{HOT_TAG}', "
            f"limit={TAG_CONCURRENCY_LIMIT}"
        )


async def ensure_global_concurrency_limit() -> None:
    async with get_client() as client:
        try:
            existing = await client.read_global_concurrency_limit_by_name(
                THROUGHPUT_LIMIT_NAME
            )
        except Exception:
            existing = None

        if existing is not None:
            print(
                f"Global concurrency limit '{THROUGHPUT_LIMIT_NAME}' already "
                f"exists (slots={existing.limit}); skipping create."
            )
            return

        from prefect.client.schemas.actions import GlobalConcurrencyLimitCreate

        await client.create_global_concurrency_limit(
            GlobalConcurrencyLimitCreate(
                name=THROUGHPUT_LIMIT_NAME,
                limit=THROUGHPUT_SLOTS,
                active=True,
                active_slots=0,
                slot_decay_per_second=0.0,
            )
        )
        print(
            f"Created global concurrency limit: name='{THROUGHPUT_LIMIT_NAME}', "
            f"slots={THROUGHPUT_SLOTS}"
        )


async def main() -> None:
    print(f"run-id = {RUN_ID}")
    await ensure_tag_concurrency_limit()
    await ensure_global_concurrency_limit()
    print("Concurrency controls are registered on the local Prefect server.")


if __name__ == "__main__":
    asyncio.run(main())
