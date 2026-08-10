"""
Prefect reporting pipeline that publishes three distinct run artifacts:

  1. A table artifact   -> regional sales report grid
  2. A progress artifact -> ingestion progress (100% when the run finishes)
  3. A link artifact    -> source location with a friendly label

All artifacts are recorded to the local Prefect server
(PREFECT_API_URL=http://127.0.0.1:4200/api) and keyed with stable
identifiers so re-running the flow accumulates version history under the
same artifact key instead of producing unrelated entries.
"""

import os

# Point the running process at the local Prefect server BEFORE prefect is
# imported so that every client it builds talks to the local API.
os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4200/api")

import time

from prefect import flow
from prefect.artifacts import (
    create_link_artifact,
    create_progress_artifact,
    create_table_artifact,
)

# ---------------------------------------------------------------------------
# Fixed input dataset (do not invent other rows or values).
# ---------------------------------------------------------------------------
RAW_SALES = [
    {"region": "north", "units_sold": 120, "unit_price": 4},
    {"region": "south", "units_sold": 75, "unit_price": 12},
    {"region": "east", "units_sold": 200, "unit_price": 3},
    {"region": "west", "units_sold": 50, "unit_price": 20},
]

RUN_ID_PATH = "/logs/artifacts/run-id"


def read_run_id() -> str:
    """Read and trim the run-id used to suffix every artifact identifier."""
    with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
        return fh.read().strip()


def build_sales_table() -> dict:
    """Build the four-column sales report as a column-oriented table.

    Columns are emitted in the exact required order:
    region, units_sold, unit_price, revenue
    """
    regions = []
    units_sold = []
    unit_price = []
    revenue = []
    for row in RAW_SALES:
        regions.append(row["region"])
        units_sold.append(row["units_sold"])
        unit_price.append(row["unit_price"])
        revenue.append(row["units_sold"] * row["unit_price"])

    return {
        "region": regions,
        "units_sold": units_sold,
        "unit_price": unit_price,
        "revenue": revenue,
    }


@flow(name="regional-sales-reporting")
def regional_sales_reporting() -> None:
    run_id = read_run_id()

    table_key = f"regional-sales-report-{run_id}"
    progress_key = f"ingest-progress-{run_id}"
    link_key = f"source-link-{run_id}"

    # --- 1. Progress artifact: reflect ingestion progress, end at 100% -------
    # Publishing intermediate values demonstrates live ingestion progress; the
    # final publish reads as fully complete (100%) once the run finishes.
    create_progress_artifact(
        progress=0.0,
        key=progress_key,
        description="Regional sales ingestion progress",
    )

    # Simulate ingestion of the fixed dataset in two stages.
    for _ in RAW_SALES:
        time.sleep(0.05)

    create_progress_artifact(
        progress=50.0,
        key=progress_key,
        description="Regional sales ingestion progress",
    )

    for _ in RAW_SALES:
        time.sleep(0.05)

    # --- 2. Table artifact: regional sales report grid -----------------------
    sales_table = build_sales_table()
    create_table_artifact(
        table=sales_table,
        key=table_key,
        description="Regional sales report (revenue = units_sold * unit_price)",
    )

    # Final progress publish: fully complete.
    create_progress_artifact(
        progress=100.0,
        key=progress_key,
        description="Regional sales ingestion progress",
    )

    # --- 3. Link artifact: source location with friendly label ---------------
    create_link_artifact(
        link="http://127.0.0.1:4200/api/health",
        link_text="Regional Sales Source",
        key=link_key,
        description="Link to the regional sales source endpoint",
    )


if __name__ == "__main__":
    regional_sales_reporting()