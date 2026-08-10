"""
Nested workflow failure roll-up demo.

Hierarchy (exactly three levels deep along the failing branch):

    orders-pipeline-<run-id>            (top level)
      +-- inventory-sync-<run-id>       (level 2, sibling, succeeds)
      +-- billing-rollup-<run-id>       (level 2, on the failing branch)
            +-- charge-settlement-<run-id>   (level 3, deterministically fails)

Running this script once drives orders-pipeline-<run-id> a single time
against the local Prefect server. Each node above is executed as its own
subflow, so every one of them is recorded as its own flow run and the
parent/child relationships render in the Prefect UI flow-run graph.
"""

import sys
from pathlib import Path

from prefect import flow

RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()


def named(base: str) -> str:
    return f"{base}-{RUN_ID}"


@flow(name=named("charge-settlement"))
def charge_settlement() -> None:
    """Level-3 grandchild workflow: deterministically fails every run."""
    print("charge-settlement: attempting to settle outstanding charges...")
    raise RuntimeError("charge-settlement: card processor declined settlement batch")


@flow(name=named("billing-rollup"))
def billing_rollup() -> None:
    """Level-2 workflow on the failing branch: invokes the level-3 workflow."""
    print("billing-rollup: starting billing roll-up, invoking charge-settlement...")
    charge_settlement()


@flow(name=named("inventory-sync"))
def inventory_sync() -> str:
    """Level-2 sibling workflow: performs its own work, no deeper calls."""
    print("inventory-sync: syncing inventory levels...")
    print("inventory-sync: sync complete")
    return "inventory-sync-ok"


@flow(name=named("orders-pipeline"))
def orders_pipeline() -> None:
    """Top-level workflow: drives both level-2 branches in a single run."""
    inventory_sync()
    billing_rollup()


if __name__ == "__main__":
    final_state = orders_pipeline(return_state=True)

    if final_state.is_failed():
        print("orders-pipeline: FAILED (expected due to charge-settlement failure)")
        sys.exit(1)

    print("orders-pipeline: COMPLETED")
    sys.exit(0)
