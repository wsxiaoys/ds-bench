import os
import time
from concurrent.futures import ThreadPoolExecutor

# Disable CSRF support in Prefect client to prevent 500 Internal Server Errors
# on local Prefect server deployments.
os.environ["PREFECT_CLIENT_CSRF_SUPPORT_ENABLED"] = "False"

from prefect import task, flow
from prefect.client.orchestration import get_client
from prefect.concurrency.sync import concurrency

# 1. Read the run-id dynamically
with open("/logs/artifacts/run-id", "r") as f:
    run_id = f.read().strip()

# Define the exact names as required
flow_name = f"guarded_pipeline_{run_id}"
tag_name = f"hotpath-{run_id}"
global_limit_name = f"throughput-{run_id}"

print(f"Loaded run-id: {run_id}")
print(f"Flow name: {flow_name}")
print(f"Tag name: {tag_name}")
print(f"Global limit name: {global_limit_name}")


# 2. Programmatic helper to ensure concurrency limits are registered on the server
def ensure_concurrency_limits():
    import asyncio
    
    async def _ensure():
        async with get_client() as client:
            # Ensure tag-run concurrency limit of exactly 1
            try:
                await client.create_concurrency_limit(tag=tag_name, concurrency_limit=1)
                print(f"Successfully ensured tag concurrency limit for {tag_name} is set to 1")
            except Exception as e:
                print(f"Tag concurrency limit already exists or encountered error: {e}")
            
            # Ensure global concurrency limit of exactly 3 slots
            try:
                await client.upsert_global_concurrency_limit_by_name(name=global_limit_name, limit=3)
                print(f"Successfully ensured global concurrency limit {global_limit_name} is set to 3")
            except Exception as e:
                print(f"Failed to upsert global concurrency limit: {e}")

    asyncio.run(_ensure())


# 3. Define the tasks and the flow
@task
def broader_processing_task(unit_id: int, stage: str):
    print(f"[{time.time():.2f}] Unit {unit_id}: Starting broader processing stage: {stage}")
    time.sleep(1.0)
    print(f"[{time.time():.2f}] Unit {unit_id}: Finished broader processing stage: {stage}")


@task(tags=[tag_name])
def critical_section_task(unit_id: int):
    print(f"[{time.time():.2f}] Unit {unit_id}: ENTERING CRITICAL SECTION")
    # Simulate work on the hot resource
    time.sleep(1.5)
    print(f"[{time.time():.2f}] Unit {unit_id}: EXITING CRITICAL SECTION")


@flow(name=flow_name)
def guarded_pipeline(unit_id: int):
    # Perform broader processing bounded by the global concurrency limit
    with concurrency(global_limit_name, occupy=1):
        broader_processing_task(unit_id, "before")
        
        # Perform critical section protected by the tag concurrency limit
        critical_section_task(unit_id)
        
        broader_processing_task(unit_id, "after")


def run_unit(unit_id: int):
    try:
        guarded_pipeline(unit_id)
    except Exception as e:
        print(f"Unit {unit_id} failed with error: {e}")


def main():
    # Ensure limits exist on the server before running
    ensure_concurrency_limits()
    
    print("\nStarting exactly 12 concurrent units of guarded_pipeline...")
    # Launch exactly 12 concurrent units at once
    with ThreadPoolExecutor(max_workers=12) as executor:
        executor.map(run_unit, range(12))
    
    print("\nAll 12 units completed successfully!")


if __name__ == "__main__":
    main()
