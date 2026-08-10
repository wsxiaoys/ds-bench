"""
Nested workflow hierarchy with failure roll-up.

Hierarchy (exactly three levels deep along one branch):

    orders-pipeline-<run-id>            (top-level, level 1)
    ├── inventory-sync-<run-id>         (level 2, successful sibling)
    └── billing-rollup-<run-id>        (level 2, failing branch)
        └── charge-settlement-<run-id> (level 3, deterministic failure)

The grandchild `charge-settlement` deterministically fails. That failure rolls
up so `billing-rollup` and the top-level `orders-pipeline` both end Failed,
while the sibling `inventory-sync` ends Completed.

Running this script exits non-zero because the top-level flow ends Failed; this
is intended.
"""

import pathlib

from prefect import flow, task, get_run_logger

# Read the run-id artifact and use it as the suffix for every registered name.
RUN_ID = pathlib.Path("/logs/artifacts/run-id").read_text().strip()


@flow(name=f"charge-settlement-{RUN_ID}")
def charge_settlement() -> None:
    """Level-3 grandchild workflow that deterministically fails every run."""
    logger = get_run_logger()
    logger.info("charge-settlement: attempting to settle charges...")
    raise RuntimeError("charge-settlement deterministically failed")


@flow(name=f"billing-rollup-{RUN_ID}")
def billing_rollup() -> None:
    """Level-2 workflow on the failing branch; invokes the grandchild."""
    logger = get_run_logger()
    logger.info("billing-rollup: starting charge roll-up...")
    # Invoking the grandchild. Its failure raises here and rolls up.
    charge_settlement()


@task
def sync_inventory_records() -> str:
    logger = get_run_logger()
    logger.info("inventory-sync: synchronizing inventory records...")
    return "inventory-synced"


@flow(name=f"inventory-sync-{RUN_ID}")
def inventory_sync() -> str:
    """Level-2 sibling workflow that runs to a successful terminal state.

    It performs its own work and does not invoke any deeper workflow.
    """
    return sync_inventory_records()


@flow(name=f"orders-pipeline-{RUN_ID}")
def orders_pipeline() -> None:
    """Top-level orchestration workflow.

    Drives both child branches within a single run. The successful sibling is
    driven first so it completes before the failing branch rolls its failure up
    to this top-level flow.
    """
    logger = get_run_logger()
    logger.info("orders-pipeline: driving child branches...")

    # Successful sibling branch: runs to completion.
    inventory_sync()

    # Failing branch: its grandchild fails and rolls up to here.
    billing_rollup()


if __name__ == "__main__":
    orders_pipeline()