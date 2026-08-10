import asyncio
import datetime
import json
import os
from prefect import flow, task, get_client
from prefect.concurrency.asyncio import concurrency

# Global state for coordination
active_tasks = {}  # task_id -> slots
ceiling_reached_event = asyncio.Event()

def get_utc_timestamp():
    dt = datetime.datetime.now(datetime.timezone.utc)
    if dt.microsecond == 0:
        dt = dt.replace(microsecond=1)
    return dt.isoformat()

@task(task_run_name="{task_id}")
async def run_critical_task(task_id: str, slots: int):
    # Record entry timestamp only after slots are actually held
    async with concurrency("critical-section", occupy=slots):
        entered_at = get_utc_timestamp()
        
        # Register task as active
        active_tasks[task_id] = slots
        current_slots = sum(active_tasks.values())
        print(f"[{task_id}] Entered critical section holding {slots} slots. Total active slots: {current_slots}")
        
        if current_slots == 4:
            print(f"[{task_id}] Ceiling of 4 slots reached!")
            ceiling_reached_event.set()
            
        # Wait for the ceiling to be reached (with a timeout of 5 seconds to prevent deadlock)
        try:
            await asyncio.wait_for(ceiling_reached_event.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            print(f"[{task_id}] Timeout waiting for ceiling event")
            
        # Remain inside the guarded section for at least 1.0 second
        await asyncio.sleep(1.5)
        
        # Before releasing slots, capture exit timestamp
        exited_at = get_utc_timestamp()
        
        # Unregister task
        active_tasks.pop(task_id, None)
        print(f"[{task_id}] Exiting critical section")
        
    return {
        "task_id": task_id,
        "slots": slots,
        "entered_at": entered_at,
        "exited_at": exited_at
    }

@flow
async def critical_section_flow():
    # 1. Ensure global concurrency limit exists and has capacity 4
    async with get_client() as client:
        await client.upsert_global_concurrency_limit_by_name(
            name="critical-section",
            limit=4
        )
        print("Upserted global concurrency limit 'critical-section' with limit 4")

    # Reset coordination event
    ceiling_reached_event.clear()
    active_tasks.clear()

    # Define tasks to run
    task_specs = [
        ("t0", 1),
        ("t1", 1),
        ("t2", 2),
        ("t3", 1),
        ("t4", 2),
        ("t5", 1),
        ("t6", 2),
        ("t7", 1),
    ]

    # Submit exactly 8 tasks concurrently
    print("Submitting 8 tasks concurrently...")
    tasks_to_run = [run_critical_task(task_id, slots) for task_id, slots in task_specs]
    results = await asyncio.gather(*tasks_to_run)
    print("All tasks finished successfully!")

    # 2. Write occupancy proof to JSON
    proof = {
        "limit_name": "critical-section",
        "total_slots": 4,
        "tasks": results
    }

    proof_path = "/home/user/project/occupancy_proof.json"
    with open(proof_path, "w") as f:
        json.dump(proof, f, indent=2)
    print(f"Occupancy proof written to {proof_path}")

    # 3. Perform self-validation
    print("Running self-validation on recorded timestamps...")
    events = []
    for r in results:
        t_ent = datetime.datetime.fromisoformat(r["entered_at"])
        t_ex = datetime.datetime.fromisoformat(r["exited_at"])
        
        # Verify entered_at < exited_at
        assert t_ent < t_ex, f"Task {r['task_id']} entered_at is not earlier than exited_at!"
        
        # Verify duration >= 1.0 second
        duration = (t_ex - t_ent).total_seconds()
        assert duration >= 1.0, f"Task {r['task_id']} duration {duration}s is less than 1.0s!"
        
        events.append((t_ent, r["slots"], "enter", r["task_id"]))
        events.append((t_ex, -r["slots"], "exit", r["task_id"]))

    # Sort events by timestamp.
    # If timestamps are identical, process exit before enter to be conservative about limit.
    events.sort(key=lambda x: (x[0], 0 if x[2] == "exit" else 1))

    current_slots = 0
    max_slots_seen = 0
    for dt, slots_change, event_type, task_id in events:
        current_slots += slots_change
        if current_slots > max_slots_seen:
            max_slots_seen = current_slots
        print(f"[{dt.isoformat()}] Task {task_id} {event_type}ed ({slots_change:+} slots). Current slots held: {current_slots}")
        assert current_slots <= 4, f"Ceiling exceeded! Held {current_slots} slots at {dt.isoformat()}"

    print(f"Peak concurrency achieved: {max_slots_seen} slots")
    assert max_slots_seen == 4, f"Ceiling of 4 slots was not reached! Peak concurrency was {max_slots_seen} slots"
    print("Validation PASSED! All requirements satisfied.")

if __name__ == "__main__":
    asyncio.run(critical_section_flow())
