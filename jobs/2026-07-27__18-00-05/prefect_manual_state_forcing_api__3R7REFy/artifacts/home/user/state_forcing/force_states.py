"""
Create 4 flow runs and force each into its assigned final state.
Uses direct API calls to the Prefect server.
"""
import asyncio
import httpx
from prefect import get_client
from prefect.client.schemas.objects import StateType
from prefect.client.schemas.actions import StateCreate

RUN_ID = "zr8d3l232h"
FLOW_NAME = f"state-forcing-flow-{RUN_ID}"
API_URL = "http://127.0.0.1:4200/api"

RUNS = [
    (f"ingest-{RUN_ID}", StateType.COMPLETED),
    (f"transform-{RUN_ID}", StateType.FAILED),
    (f"validate-{RUN_ID}", StateType.CANCELLED),
    (f"publish-{RUN_ID}", StateType.CRASHED),
]


async def main():
    async with get_client() as client:
        # Find the flow
        flows = await client.read_flows()
        flow = next((f for f in flows if f.name == FLOW_NAME), None)
        if flow is None:
            print(f"ERROR: Flow '{FLOW_NAME}' not found.")
            return
        flow_id = flow.id
        print(f"Found flow: {FLOW_NAME} (id={flow_id})")

        # Delete any existing flow runs for this flow
        existing_runs = await client.read_flow_runs()
        for fr in existing_runs:
            if fr.flow_id == flow_id:
                print(f"  Deleting existing run: {fr.name} (id={fr.id})")
                try:
                    await client._client.delete(f"/flow_runs/{fr.id}")
                except Exception as e:
                    print(f"    Delete failed: {e}")

        # Create 4 runs using direct REST API
        async with httpx.AsyncClient(base_url=API_URL) as http:
            for run_name, target_state in RUNS:
                # Create flow run via REST API
                payload = {
                    "flow_id": str(flow_id),
                    "name": run_name,
                    "state": {"type": "SCHEDULED"},
                }
                resp = await http.post("/flow_runs/", json=payload)
                if resp.status_code >= 400:
                    print(f"ERROR creating {run_name}: {resp.status_code} {resp.text}")
                    continue
                fr_data = resp.json()
                run_id = fr_data["id"]
                print(f"Created: {run_name} (id={run_id})")

                # Force state via REST API
                state_payload = {
                    "state": {
                        "type": target_state.value,
                        "message": f"Forced to {target_state.value}",
                    },
                    "force": True,
                }
                resp2 = await http.post(f"/flow_runs/{run_id}/set_state", json=state_payload)
                if resp2.status_code >= 400:
                    print(f"  ERROR forcing state for {run_name}: {resp2.status_code} {resp2.text}")
                else:
                    result = resp2.json()
                    actual_state = result.get("state", {}).get("type", "?")
                    print(f"  → Forced to {actual_state}")

        # Verify
        print("\n--- Verifying final states ---")
        for run_name, expected_state in RUNS:
            frs = await client.read_flow_runs()
            fr = next((r for r in frs if r.name == run_name), None)
            if fr:
                actual = fr.state_type
                match = "✓" if actual == expected_state else "✗"
                print(f"  {match} {run_name}: {actual} (expected: {expected_state})")
            else:
                print(f"  ? {run_name}: NOT FOUND")

        print("\nDone. Check the UI at http://127.0.0.1:4200/runs")


if __name__ == "__main__":
    asyncio.run(main())
