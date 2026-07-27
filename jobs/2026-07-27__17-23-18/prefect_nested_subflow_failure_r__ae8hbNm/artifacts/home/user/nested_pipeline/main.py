import os
import sys

# Ensure Prefect points to the local server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

from prefect import flow

# Read run-id
RUN_ID_FILE = "/logs/artifacts/run-id"
try:
    with open(RUN_ID_FILE, "r") as f:
        run_id = f.read().strip()
except Exception as e:
    print(f"Error reading run-id file: {e}")
    sys.exit(1)

@flow(name=f"charge-settlement-{run_id}")
def charge_settlement():
    print("Executing charge-settlement...")
    raise ValueError("Deterministic failure in charge-settlement")

@flow(name=f"billing-rollup-{run_id}")
def billing_rollup():
    print("Executing billing-rollup...")
    charge_settlement()

@flow(name=f"inventory-sync-{run_id}")
def inventory_sync():
    print("Executing inventory-sync...")
    # Sibling child workflow performs some work and succeeds
    return "Inventory sync completed successfully"

@flow(name=f"orders-pipeline-{run_id}")
def orders_pipeline():
    print("Starting orders-pipeline...")
    # Run successful sibling branch first
    inventory_sync()
    # Run failing branch
    billing_rollup()

if __name__ == "__main__":
    try:
        orders_pipeline()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Workflow execution failed as expected: {e}")
        # The run command is expected to exit with a non-zero status
        sys.exit(1)
