"""
Prefect flow: orders-etl-<run-id>

Dynamically names flow runs and task runs based on input parameters.
"""

from pathlib import Path

from prefect import flow, task

# Read the run-id from the artifacts file
RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()


@flow(
    name=f"orders-etl-{RUN_ID}",
    flow_run_name="ingest-{region}-b{batch}-" + RUN_ID,
)
def orders_etl(region: str, batch: int) -> str:
    """ETL flow that ingests and transforms order data."""

    result = transform_data(region, batch)
    return result


@task(
    name=f"transform_data",
    task_run_name="transform-{region}-b{batch}-" + RUN_ID,
)
def transform_data(region: str, batch: int) -> str:
    """Transform task that processes order data for a given region and batch."""
    return f"Processed {region} batch {batch}"
