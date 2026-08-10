#!/usr/bin/env python3
import os
import sys

# Ensure PREFECT_API_URL is set to our local server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

from prefect import flow, task

# Read run-id from /logs/artifacts/run-id
try:
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
except FileNotFoundError:
    print("Error: /logs/artifacts/run-id not found", file=sys.stderr)
    sys.exit(1)

@task(task_run_name=f"transform-{{region}}-b{{batch}}-{run_id}")
def transform_data(region: str, batch: int):
    print(f"Transforming data for region: {region}, batch: {batch}")
    return f"Processed {region} batch {batch}"

@flow(
    name=f"orders-etl-{run_id}",
    flow_run_name=f"ingest-{{region}}-b{{batch}}-{run_id}"
)
def orders_etl(region: str, batch: int):
    print(f"Starting flow for region: {region}, batch: {batch}")
    result = transform_data(region=region, batch=batch)
    print(f"Finished flow with result: {result}")

if __name__ == "__main__":
    inputs = [
        {"region": "emea", "batch": 10},
        {"region": "apac", "batch": 25},
        {"region": "amer", "batch": 50}
    ]
    
    for inp in inputs:
        print(f"Executing: {inp}")
        orders_etl(region=inp["region"], batch=inp["batch"])
