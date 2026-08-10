import sys
from prefect import flow, task
from prefect.futures import resolve_futures_to_states

# Read run-id dynamically
with open("/logs/artifacts/run-id", "r") as f:
    run_id = f.read().strip()

@task
def process_number(x: int) -> int:
    """
    Process a single input integer.
    Fails (raises an exception) if the integer is an exact multiple of 4.
    """
    if x % 4 == 0:
        raise ValueError(f"Task failed for input {x}: Exact multiple of 4")
    return x

@flow(name=f"mapped-fanout-{run_id}")
def mapped_fanout_flow():
    """
    Prefect flow that dynamically distributes work across 20 inputs.
    Ensures all tasks run to completion concurrently and records their states.
    Fails the flow run if any child task runs failed.
    """
    inputs = list(range(1, 21))
    
    # Map task concurrently across all 20 inputs
    futures = process_number.map(inputs)
    
    # Wait for all 20 child task runs to complete (terminal state)
    futures.wait()
    
    # Resolve futures to their final states to inspect results
    states = resolve_futures_to_states(futures)
    
    # Count failed task runs
    failed_states = [s for s in states if s.is_failed()]
    
    print(f"Total tasks: {len(states)}")
    print(f"Completed tasks: {len(states) - len(failed_states)}")
    print(f"Failed tasks: {len(failed_states)}")
    
    # If any task runs failed, raise an exception to fail the flow run
    if failed_states:
        raise ValueError(f"Flow run failed because {len(failed_states)} child task runs failed.")

if __name__ == "__main__":
    try:
        mapped_fanout_flow()
    except Exception as e:
        print(f"Flow executed and raised exception as expected: {e}")
