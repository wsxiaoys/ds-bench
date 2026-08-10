import os
import asyncio
import time
from prefect import flow, get_client
from prefect.client.schemas.actions import GlobalConcurrencyLimitCreate
from prefect.concurrency.asyncio import rate_limit

# Configure Prefect API URL to use the local server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

# Read run ID
with open("/logs/artifacts/run-id", "r") as f:
    run_id = f.read().strip()

limit_name = f"partner-api-throttle-{run_id}"
flow_name = f"throttled-dispatch-{run_id}"

@flow(name=flow_name)
async def throttled_dispatch(unit_id: int):
    t_start = time.time()
    # Acquire a slot from the throughput-control resource
    await rate_limit(limit_name)
    duration = time.time() - t_start
    print(f"Work unit {unit_id} acquired permit after {duration:.2f} seconds")
    # Simulate a small unit of work
    await asyncio.sleep(0.1)
    print(f"Work unit {unit_id} completed successfully")

async def main():
    print(f"Initializing throttling workflow for run-id: {run_id}")
    
    async with get_client() as client:
        # 1. Ensure the throughput-control resource exists with the exact configuration
        try:
            existing = await client.read_global_concurrency_limit_by_name(name=limit_name)
            print(f"Found existing global concurrency limit: {existing}")
            await client.delete_global_concurrency_limit_by_name(name=limit_name)
            print("Deleted existing limit to apply fresh configuration")
        except Exception:
            print("No existing global concurrency limit found")
            
        gcl_create = GlobalConcurrencyLimitCreate(
            name=limit_name,
            limit=4,
            active=True,
            slot_decay_per_second=1.5
        )
        limit_id = await client.create_global_concurrency_limit(concurrency_limit=gcl_create)
        print(f"Created throughput-control resource '{limit_name}' with ID: {limit_id}")
        
        # Verify the created resource
        limit_obj = await client.read_global_concurrency_limit_by_name(name=limit_name)
        print(f"Verified limit configuration: limit={limit_obj.limit}, slot_decay_per_second={limit_obj.slot_decay_per_second}, active={limit_obj.active}")
        
        # 2. Clean up any previous flow runs for this flow to ensure exactly 12 runs in the UI
        flows = await client.read_flows()
        target_flow = next((f for f in flows if f.name == flow_name), None)
        if target_flow:
            print(f"Found existing flow '{flow_name}', cleaning up its previous runs...")
            runs = await client.read_flow_runs()
            deleted_count = 0
            for run in runs:
                if run.flow_id == target_flow.id:
                    await client.delete_flow_run(run.id)
                    deleted_count += 1
            print(f"Deleted {deleted_count} previous flow runs")

    # 3. Dispatch exactly 12 work units concurrently
    print("Dispatching 12 work units...")
    t_dispatch_start = time.time()
    
    tasks = [throttled_dispatch(i) for i in range(12)]
    await asyncio.gather(*tasks)
    
    total_duration = time.time() - t_dispatch_start
    print(f"All 12 work units completed! Total dispatch duration: {total_duration:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
