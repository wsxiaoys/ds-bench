"""
Flow definitions for the nested pipeline hierarchy.

Hierarchy:
  orders-pipeline-<run-id> (top-level)
    ├── inventory-sync-<run-id> (level-2, successful sibling)
    └── billing-rollup-<run-id> (level-2, failing branch)
          └── charge-settlement-<run-id> (level-3, deterministic failure)

The flows call each other directly as Python functions. When a @flow-decorated
function is called from within another flow, Prefect automatically creates a
subflow run, establishing the parent-child relationship in the UI.

Each flow is also deployed to the server so its metadata is registered.
"""

from prefect import flow


def _read_run_id():
    with open("/logs/artifacts/run-id") as f:
        return f.read().strip()


# Build the flow names with run-id suffix
_run_id = _read_run_id()


@flow(name=f"charge-settlement-{_run_id}", log_prints=True)
def charge_settlement():
    """Level-3 grandchild: deterministically fails every time."""
    raise RuntimeError("charge-settlement: deterministic failure")


@flow(name=f"billing-rollup-{_run_id}", log_prints=True)
def billing_rollup():
    """Level-2 child on the failing branch: invokes the level-3 grandchild."""
    charge_settlement()


@flow(name=f"inventory-sync-{_run_id}", log_prints=True)
def inventory_sync():
    """Level-2 sibling on the successful branch: does its own work, no deeper calls."""
    return {"status": "ok", "items_synced": 42}


@flow(name=f"orders-pipeline-{_run_id}", log_prints=True)
def orders_pipeline():
    """Top-level workflow: drives both level-2 children.

    The sibling branch (inventory-sync) completes successfully.
    The failing branch (billing-rollup -> charge-settlement) fails and rolls up.
    """
    # Run the successful sibling branch
    inventory_sync()

    # Run the failing branch (this will raise because the grandchild fails)
    billing_rollup()
