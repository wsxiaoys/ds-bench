"""
Prefect reporting pipeline that publishes three distinct artifact types
(table, progress, link) to a local Prefect server, tied to the current
flow run. Re-running the flow accumulates version history for the table
artifact because it is published under the same stable key each time.
"""

from pathlib import Path

from prefect import flow, task, get_run_logger
from prefect.artifacts import (
    create_table_artifact,
    create_progress_artifact,
    update_progress_artifact,
    create_link_artifact,
)

RUN_ID_FILE = Path("/logs/artifacts/run-id")

# Fixed input dataset -- do not modify.
SALES_DATA = [
    {"region": "north", "units_sold": 120, "unit_price": 4},
    {"region": "south", "units_sold": 75, "unit_price": 12},
    {"region": "east", "units_sold": 200, "unit_price": 3},
    {"region": "west", "units_sold": 50, "unit_price": 20},
]


def read_run_id() -> str:
    return RUN_ID_FILE.read_text().strip()


@task
def build_table_rows() -> list[dict]:
    """Derive the revenue column and return rows in fixed column order."""
    rows = []
    for row in SALES_DATA:
        rows.append(
            {
                "region": row["region"],
                "units_sold": row["units_sold"],
                "unit_price": row["unit_price"],
                "revenue": row["units_sold"] * row["unit_price"],
            }
        )
    return rows


@task
def publish_table_artifact(rows: list[dict], key: str) -> None:
    create_table_artifact(
        key=key,
        table=rows,
        description="Regional sales report (region, units_sold, unit_price, revenue).",
    )


@task
def ingest_with_progress(key: str) -> None:
    """Simulate ingestion, updating a progress artifact to completion."""
    logger = get_run_logger()
    artifact_id = create_progress_artifact(
        key=key,
        progress=0.0,
        description="Ingestion progress for the regional sales report.",
    )
    steps = [25.0, 50.0, 75.0, 100.0]
    for pct in steps:
        logger.info(f"Ingestion progress: {pct}%")
        update_progress_artifact(artifact_id=artifact_id, progress=pct)


@task
def publish_link_artifact(key: str) -> None:
    create_link_artifact(
        key=key,
        link="http://127.0.0.1:4200/api/health",
        link_text="Regional Sales Source",
        description="Source location for the regional sales data.",
    )


@flow(name="regional-sales-reporting")
def regional_sales_reporting_flow():
    run_id = read_run_id()

    table_key = f"regional-sales-report-{run_id}"
    progress_key = f"ingest-progress-{run_id}"
    link_key = f"source-link-{run_id}"

    rows = build_table_rows()
    publish_table_artifact(rows, key=table_key)
    ingest_with_progress(key=progress_key)
    publish_link_artifact(key=link_key)


if __name__ == "__main__":
    regional_sales_reporting_flow()
