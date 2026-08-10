"""
Regional Sales Reporting Pipeline

Produces three artifact types per run:
  1. Table artifact  — regional sales report with revenue column
  2. Progress artifact — ingestion progress, 100% on completion
  3. Link artifact     — points to the API health endpoint

Stable identifiers (keyed off /logs/artifacts/run-id) ensure that re-runs
accumulate version history under the same artifact keys.
"""

from pathlib import Path

from prefect import flow
from prefect.artifacts import (
    create_link_artifact,
    create_progress_artifact,
    create_table_artifact,
)


def read_run_id() -> str:
    """Return the trimmed run-id from /logs/artifacts/run-id."""
    return Path("/logs/artifacts/run-id").read_text().strip()


@flow(name="regional-sales-reporting-pipeline")
def reporting_pipeline() -> None:
    run_id = read_run_id()

    # ------------------------------------------------------------------
    # 1. Table artifact — regional sales report
    # ------------------------------------------------------------------
    table_key = f"regional-sales-report-{run_id}"

    sales_data = [
        {"region": "north", "units_sold": 120, "unit_price": 4, "revenue": 480},
        {"region": "south", "units_sold": 75,  "unit_price": 12, "revenue": 900},
        {"region": "east",  "units_sold": 200, "unit_price": 3,  "revenue": 600},
        {"region": "west",  "units_sold": 50,  "unit_price": 20, "revenue": 1000},
    ]

    create_table_artifact(
        table=sales_data,
        key=table_key,
        description="Regional sales report with derived revenue",
    )

    # ------------------------------------------------------------------
    # 2. Progress artifact — ingestion progress (100 % complete)
    # ------------------------------------------------------------------
    progress_key = f"ingest-progress-{run_id}"

    create_progress_artifact(
        progress=100.0,
        key=progress_key,
        description="Ingestion progress for the current reporting run",
    )

    # ------------------------------------------------------------------
    # 3. Link artifact — points to the API health endpoint
    # ------------------------------------------------------------------
    link_key = f"source-link-{run_id}"

    create_link_artifact(
        link="http://127.0.0.1:4200/api/health",
        link_text="Regional Sales Source",
        key=link_key,
        description="Link to the regional sales data source",
    )


if __name__ == "__main__":
    reporting_pipeline()
