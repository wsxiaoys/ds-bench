#!/usr/bin/env python3
"""
Prefect pipeline that ingests orders data with dynamic, parameter-derived
flow-run and task-run names.

The run-id is read from /logs/artifacts/run-id and appended (after a hyphen)
to every dynamically generated name, as required.
"""

from pathlib import Path

from prefect import flow, task


def _read_run_id() -> str:
    run_id_path = Path("/logs/artifacts/run-id")
    return run_id_path.read_text().strip()


RUN_ID = _read_run_id()

# Prefect fills in "{region}" / "{batch}" from the run's own parameter values
# at run time, since flow_run_name / task_run_name only support zero-arg
# callables (or plain template strings) -- not callables that accept the
# task/flow's parameters directly.
FLOW_RUN_NAME_TEMPLATE = f"ingest-{{region}}-b{{batch}}-{RUN_ID}"
TASK_RUN_NAME_TEMPLATE = f"transform-{{region}}-b{{batch}}-{RUN_ID}"


@task(name="transform", task_run_name=TASK_RUN_NAME_TEMPLATE)
def transform(region: str, batch: int) -> str:
    """Simulate transforming a batch of orders for a given region."""
    result = f"transformed {batch} order(s) for region '{region}'"
    print(result)
    return result


@flow(
    name=f"orders-etl-{RUN_ID}",
    flow_run_name=FLOW_RUN_NAME_TEMPLATE,
)
def orders_etl(region: str, batch: int) -> str:
    """Ingest and transform orders for a given region/batch."""
    return transform(region, batch)


INPUT_SETS = [
    {"region": "emea", "batch": 10},
    {"region": "apac", "batch": 25},
    {"region": "amer", "batch": 50},
]


def main() -> None:
    for inputs in INPUT_SETS:
        orders_etl(**inputs)


if __name__ == "__main__":
    main()
