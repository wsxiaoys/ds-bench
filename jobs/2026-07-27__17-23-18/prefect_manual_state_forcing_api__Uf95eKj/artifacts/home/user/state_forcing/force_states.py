import asyncio
from pathlib import Path
from prefect import flow
from prefect.client.orchestration import get_client
from prefect.states import Completed, Failed, Cancelled, Crashed

def get_run_id() -> str:
    """Reads the run-id from /logs/artifacts/run-id."""
    try:
        return Path("/logs/artifacts/run-id").read_text().strip()
    except Exception as e:
        print(f"Error reading run-id, defaulting to local-dev: {e}")
        return "local-dev"

RUN_ID = get_run_id()
FLOW_NAME = f"state-forcing-flow-{RUN_ID}"

@flow(name=FLOW_NAME)
def state_forcing_flow():
    """A single flow definition shared by all forced runs."""
    pass

async def main():
    async with get_client() as client:
        print(f"Using Prefect Server at: {client.api_url}")
        
        # 1. Clean up any existing runs to ensure exactly four runs exist
        print("Cleaning up existing runs...")
        existing_runs = await client.read_flow_runs()
        for fr in existing_runs:
            print(f"Deleting existing run: {fr.name} ({fr.id})")
            await client.delete_flow_run(fr.id)

        # 2. Define the exact runs and their assigned final states
        runs_to_create = [
            (f"ingest-{RUN_ID}", Completed()),
            (f"transform-{RUN_ID}", Failed()),
            (f"validate-{RUN_ID}", Cancelled()),
            (f"publish-{RUN_ID}", Crashed()),
        ]

        # 3. Create flow runs and force them into their assigned states
        for run_name, target_state in runs_to_create:
            # Create a flow run (initially in Pending state)
            flow_run = await client.create_flow_run(flow=state_forcing_flow, name=run_name)
            print(f"Created flow run: '{run_name}' with ID: {flow_run.id}")

            # Force transition to the assigned final state
            result = await client.set_flow_run_state(
                flow_run_id=flow_run.id,
                state=target_state,
                force=True
            )
            print(f"Forced state transition for '{run_name}' to {target_state.name}: {result.status}")

        # 4. Verify all runs and their final states
        print("\nVerifying final states in Prefect Server:")
        final_runs = await client.read_flow_runs()
        print(f"Total Runs: {len(final_runs)}")
        for fr in final_runs:
            print(f" - Run Name: {fr.name}")
            print(f"   Flow Name: {FLOW_NAME}")
            print(f"   Final State: {fr.state.name}")

if __name__ == "__main__":
    asyncio.run(main())
