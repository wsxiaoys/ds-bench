import asyncio
import json
import sys
import time
import threading
from prefect import flow, task, get_client
from prefect.exceptions import ObjectNotFound
from prefect.concurrency.asyncio import concurrency

LOG_FILE = "/home/user/project/occupancy.jsonl"
write_lock = threading.Lock()

def log_event(event: str, unit_id: int):
    ts = time.time()
    data = {
        "event": event,
        "unit": unit_id,
        "ts": ts
    }
    line = json.dumps(data) + "\n"
    with write_lock:
        with open(LOG_FILE, "a") as f:
            f.write(line)
            f.flush()

@task
async def work_unit(unit_id: int):
    # Each work unit must acquire exactly one slot on the `render-pool` limit for the entire duration of its work
    async with concurrency("render-pool", occupy=1, strict=True):
        # Write exactly one `acquire` event immediately after its slot is acquired (before the work begins)
        log_event("acquire", unit_id)
        
        # Simulated work must hold that slot for at least 1.0 second so contention is observable
        await asyncio.sleep(3.0)
        
        # Write exactly one `release` event immediately after its work finishes (as its slot is released)
        log_event("release", unit_id)

@flow
async def pipeline():
    # Overwrite the occupancy.jsonl file so it reflects only this run
    with open(LOG_FILE, "w") as f:
        pass
    
    # Submit exactly 12 work units concurrently
    futures = [work_unit.submit(i) for i in range(12)]
    
    # Wait for all work units to complete and propagate any exception (e.g. ConcurrencySlotAcquisitionError)
    for f in futures:
        f.result()

async def verify_limit_exists():
    async with get_client() as client:
        try:
            await client.read_global_concurrency_limit_by_name("render-pool")
            return True
        except ObjectNotFound:
            return False

async def main():
    # Check if the render-pool limit exists before running the batch unthrottled
    if not await verify_limit_exists():
        print("Error: 'render-pool' global concurrency limit does not exist on the server.", file=sys.stderr)
        sys.exit(1)
        
    await pipeline()

if __name__ == "__main__":
    asyncio.run(main())
