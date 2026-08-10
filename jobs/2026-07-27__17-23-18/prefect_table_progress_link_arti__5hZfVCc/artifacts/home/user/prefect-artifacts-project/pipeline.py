import os
import time
from prefect import flow, task
from prefect.artifacts import (
    create_table_artifact,
    create_progress_artifact,
    create_link_artifact,
    update_progress_artifact,
)

# Ensure PREFECT_API_URL is set in environment
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

@flow(name="regional-sales-pipeline")
def sales_pipeline():
    # Read the run-id
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()

    # Artifact identifiers
    table_key = f"regional-sales-report-{run_id}"
    progress_key = f"ingest-progress-{run_id}"
    link_key = f"source-link-{run_id}"

    # 1. Create progress artifact at 0%
    progress_id = create_progress_artifact(
        progress=0.0,
        key=progress_key,
        description="Data ingestion and processing progress"
    )
    time.sleep(1) # simulate some work

    # Update progress to 50%
    update_progress_artifact(
        artifact_id=progress_id,
        progress=50.0,
        description="Processing sales data"
    )
    time.sleep(1) # simulate some work

    # 2. Create table artifact
    table_data = [
        {"region": "north", "units_sold": 120, "unit_price": 4, "revenue": 480},
        {"region": "south", "units_sold": 75, "unit_price": 12, "revenue": 900},
        {"region": "east", "units_sold": 200, "unit_price": 3, "revenue": 600},
        {"region": "west", "units_sold": 50, "unit_price": 20, "revenue": 1000},
    ]

    create_table_artifact(
        table=table_data,
        key=table_key,
        description="Regional Sales Report Grid"
    )

    # 3. Create link artifact
    create_link_artifact(
        link="http://127.0.0.1:4200/api/health",
        link_text="Regional Sales Source",
        key=link_key,
        description="Source location API health"
    )

    # 4. Update progress artifact to 100%
    update_progress_artifact(
        artifact_id=progress_id,
        progress=100.0,
        description="Ingestion and reporting complete"
    )

if __name__ == "__main__":
    sales_pipeline()
