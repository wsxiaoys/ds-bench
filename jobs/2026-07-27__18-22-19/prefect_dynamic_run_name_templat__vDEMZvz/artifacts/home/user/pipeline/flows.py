"""Orders ETL Prefect flow with dynamic, parameter-derived run names.

The flow name, every flow-run name and every task-run name embed the run-id
read from /logs/artifacts/run-id so each run is self-describing in the UI.

In Prefect 3.7.8 a ``flow_run_name``/``task_run_name`` string template is
formatted via ``str.format(**parameters)`` where ``parameters`` is the dict of
the run's own input values. We therefore use templates whose ``{region}`` and
``{batch}`` placeholders are filled from the run's inputs, while the ``<run-id>``
portion is baked into the template literally at definition time (escaped via
doubled braces in the f-string so it survives as a literal for ``.format()``).
"""

from __future__ import annotations

from pathlib import Path

from prefect import flow, task

RUN_ID_FILE = Path("/logs/artifacts/run-id")


def read_run_id() -> str:
    """Read the run-id from the artifacts file, stripping any whitespace."""
    return RUN_ID_FILE.read_text().strip()


RUN_ID = read_run_id()

# Flow name (registered name of the flow itself): orders-etl-<run-id>
FLOW_NAME = f"orders-etl-{RUN_ID}"

# Flow-run name template: ingest-{region}-b{batch}-<run-id>
# {region} and {batch} are filled by Prefect from the flow's parameters.
FLOW_RUN_NAME = f"ingest-{{region}}-b{{batch}}-{RUN_ID}"

# Task-run name template: transform-{region}-b{batch}-<run-id>
# {region} and {batch} are filled by Prefect from the task's parameters.
TASK_RUN_NAME = f"transform-{{region}}-b{{batch}}-{RUN_ID}"


@task(task_run_name=TASK_RUN_NAME)
def transform_orders(region: str, batch: int) -> dict:
    """A representative transformation task.

    The task receives the same region/batch values as its enclosing flow run so
    the task-run name can be derived from those inputs.
    """
    return {
        "region": region,
        "batch": batch,
        "records_transformed": batch,
        "status": "transformed",
    }


@flow(name=FLOW_NAME, flow_run_name=FLOW_RUN_NAME)
def orders_etl(region: str, batch: int) -> dict:
    """Ingest + transform orders for a region/batch.

    The flow-run name and the enclosed task-run name are both derived from the
    region and batch input values (plus the shared run-id).
    """
    result = transform_orders(region=region, batch=batch)
    return result