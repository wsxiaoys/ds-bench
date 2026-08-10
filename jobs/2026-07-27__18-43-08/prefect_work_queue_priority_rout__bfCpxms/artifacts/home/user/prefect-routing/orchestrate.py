#!/usr/bin/env python3
"""
Idempotent orchestration for the prioritized work-queue routing exercise.

Subcommands:
  setup   - Ensure the work pool, its three priority/concurrency-bounded work
            queues, and the three routed deployments exist (create-or-update).
  trigger - Submit exactly one flow run for each of the three deployments and
            block until all three reach a terminal state. Exits 0 only if all
            three runs completed successfully.

Both subcommands are safe to run multiple times against the same server.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from prefect.client.orchestration import get_client
from prefect.client.schemas.actions import WorkPoolCreate, WorkPoolUpdate
from prefect.exceptions import ObjectAlreadyExists, ObjectNotFound

PROJECT_DIR = Path(__file__).resolve().parent
RUN_ID_FILE = Path("/logs/artifacts/run-id")


def get_run_id() -> str:
    return RUN_ID_FILE.read_text().strip()


def names(run_id: str) -> dict:
    return {
        "pool": f"routing-pool-{run_id}",
        "queues": {
            f"critical-{run_id}": {"priority": 1, "concurrency_limit": 1},
            f"standard-{run_id}": {"priority": 5, "concurrency_limit": 3},
            f"bulk-{run_id}": {"priority": 10, "concurrency_limit": 5},
        },
        "deployments": {
            f"critical-deploy-{run_id}": {
                "queue": f"critical-{run_id}",
                "label": "critical",
            },
            f"standard-deploy-{run_id}": {
                "queue": f"standard-{run_id}",
                "label": "standard",
            },
            f"bulk-deploy-{run_id}": {
                "queue": f"bulk-{run_id}",
                "label": "bulk",
            },
        },
    }


async def ensure_work_pool(client, pool_name: str) -> None:
    try:
        await client.read_work_pool(pool_name)
        print(f"[setup] work pool {pool_name!r} already exists")
    except ObjectNotFound:
        try:
            await client.create_work_pool(
                WorkPoolCreate(name=pool_name, type="process")
            )
            print(f"[setup] created work pool {pool_name!r}")
        except ObjectAlreadyExists:
            print(f"[setup] work pool {pool_name!r} already exists (race)")


async def ensure_work_queue(
    client, pool_name: str, queue_name: str, priority: int, concurrency_limit: int
) -> None:
    try:
        queue = await client.read_work_queue_by_name(
            name=queue_name, work_pool_name=pool_name
        )
        await client.update_work_queue(
            queue.id,
            priority=priority,
            concurrency_limit=concurrency_limit,
        )
        print(
            f"[setup] updated work queue {queue_name!r} "
            f"(priority={priority}, concurrency_limit={concurrency_limit})"
        )
    except ObjectNotFound:
        await client.create_work_queue(
            name=queue_name,
            work_pool_name=pool_name,
            priority=priority,
            concurrency_limit=concurrency_limit,
        )
        print(
            f"[setup] created work queue {queue_name!r} "
            f"(priority={priority}, concurrency_limit={concurrency_limit})"
        )


async def setup_topology(run_id: str) -> None:
    cfg = names(run_id)
    async with get_client() as client:
        await ensure_work_pool(client, cfg["pool"])
        for queue_name, spec in cfg["queues"].items():
            await ensure_work_queue(
                client,
                cfg["pool"],
                queue_name,
                spec["priority"],
                spec["concurrency_limit"],
            )


def register_deployments(run_id: str) -> None:
    # Imported lazily so that `setup_topology`'s asyncio usage doesn't
    # conflict with the sync wrappers used by Flow.deploy().
    from prefect import flow
    from prefect.runner.storage import LocalStorage

    cfg = names(run_id)
    source_flow = flow.from_source(
        source=LocalStorage(path=str(PROJECT_DIR)),
        entrypoint="flows.py:routing_flow",
    )

    for deployment_name, spec in cfg["deployments"].items():
        deployment_id = source_flow.deploy(
            name=deployment_name,
            work_pool_name=cfg["pool"],
            work_queue_name=spec["queue"],
            build=False,
            push=False,
            image=None,
            parameters={"label": spec["label"]},
            ignore_warnings=True,
            print_next_steps=False,
        )
        print(
            f"[setup] deployment {deployment_name!r} -> queue {spec['queue']!r} "
            f"(id={deployment_id})"
        )


def cmd_setup() -> None:
    run_id = get_run_id()
    asyncio.run(setup_topology(run_id))
    register_deployments(run_id)


def cmd_trigger() -> None:
    from prefect.deployments import run_deployment

    run_id = get_run_id()
    cfg = names(run_id)

    flow_runs = []
    for deployment_name in cfg["deployments"]:
        full_name = f"routing-flow/{deployment_name}"
        print(f"[trigger] submitting run for {full_name!r} ...")
        # timeout=0 schedules the run and returns immediately without
        # blocking, so we can submit all three before waiting on any.
        flow_run = run_deployment(name=full_name, timeout=0)
        flow_runs.append((deployment_name, flow_run.id))
        print(f"[trigger] submitted flow run {flow_run.id} for {full_name!r}")

    raise SystemExit(_wait_for_all(flow_runs))


def _wait_for_all(flow_runs) -> int:
    from prefect.client.orchestration import get_client as _get_client

    async def _poll():
        terminal = {}
        pending = dict(flow_runs)
        async with _get_client() as client:
            while pending:
                for name, fr_id in list(pending.items()):
                    run = await client.read_flow_run(fr_id)
                    if run.state and run.state.is_final():
                        terminal[name] = run.state
                        pending.pop(name)
                        print(
                            f"[trigger] {name!r} reached terminal state: "
                            f"{run.state.type.value} ({run.state.name})"
                        )
                if pending:
                    await asyncio.sleep(2)
        return terminal

    terminal_states = asyncio.run(_poll())
    ok = True
    for name, state in terminal_states.items():
        if not state.is_completed():
            print(f"[trigger] ERROR: {name!r} did not complete: {state}")
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"setup", "trigger"}:
        print("Usage: orchestrate.py [setup|trigger]", file=sys.stderr)
        sys.exit(2)

    if sys.argv[1] == "setup":
        cmd_setup()
    else:
        cmd_trigger()
