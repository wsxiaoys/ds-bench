import os
import sys

# Ensure Prefect targets the local server ONLY
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

import asyncio
import subprocess
from prefect import flow, get_client
from prefect.concurrency.asyncio import concurrency

def get_run_id():
    try:
        with open("/logs/artifacts/run-id", "r") as f:
            return f.read().strip()
    except FileNotFoundError:
        return "localtest"

RUN_ID = get_run_id()
FLOW_NAME = f"payload-unit-{RUN_ID}"
LIMIT_NAME = f"throughput-guard-{RUN_ID}"

@flow(name=FLOW_NAME)
async def run_payload_unit(index: int):
    print(f"Flow run {index} starting and attempting to acquire slot on {LIMIT_NAME}...")
    async with concurrency(LIMIT_NAME, occupy=1):
        print(f"Flow run {index} acquired slot on {LIMIT_NAME}. Executing work...")
        # Simulate work
        await asyncio.sleep(3)
        print(f"Flow run {index} completed work and releasing slot.")

async def ensure_concurrency_limit():
    print(f"Ensuring global concurrency limit '{LIMIT_NAME}' exists with 2 slots...")
    async with get_client() as client:
        await client.upsert_global_concurrency_limit_by_name(
            name=LIMIT_NAME,
            limit=2
        )
    print(f"Global concurrency limit '{LIMIT_NAME}' is active with 2 slots.")

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        # We are a worker process running a single flow run unit
        index = int(sys.argv[2])
        asyncio.run(run_payload_unit(index))
    else:
        # We are the main orchestrator process
        # 1. Ensure the concurrency limit exists
        asyncio.run(ensure_concurrency_limit())

        # 2. Launch exactly 8 units of work concurrently as separate processes
        print("Launching 8 independent flow runs concurrently...")
        procs = []
        env = os.environ.copy()
        
        for i in range(8):
            p = subprocess.Popen([sys.executable, __file__, "--worker", str(i)], env=env)
            procs.append(p)

        # 3. Wait for all processes to complete
        for p in procs:
            p.wait()
        
        print("All 8 units of work have completed successfully!")

if __name__ == "__main__":
    main()
