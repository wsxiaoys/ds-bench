import asyncio
from prefect import flow, get_client
from flow import pulse

async def main():
    # Read run-id
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()

    print(f"Run ID: {run_id}")

    active_name = f"pulse-active-{run_id}"
    paused_name = f"pulse-paused-{run_id}"

    async with get_client() as client:
        # Delete existing active deployment if it exists
        try:
            dep_active = await client.read_deployment_by_name(f"pulse/{active_name}")
            print(f"Deleting existing active deployment {dep_active.id}...")
            await client.delete_deployment(dep_active.id)
        except Exception:
            pass

        # Delete existing paused deployment if it exists
        try:
            dep_paused = await client.read_deployment_by_name(f"pulse/{paused_name}")
            print(f"Deleting existing paused deployment {dep_paused.id}...")
            await client.delete_deployment(dep_paused.id)
        except Exception:
            pass

    # Now create new deployments
    print("Creating active deployment...")
    dep_active_obj = await pulse.to_deployment(
        name=active_name,
        interval=30,
        paused=False,
    )
    active_id = await dep_active_obj.aapply()
    print(f"Created active deployment: {active_id}")

    print("Creating paused deployment...")
    dep_paused_obj = await pulse.to_deployment(
        name=paused_name,
        interval=30,
        paused=True,
    )
    paused_id = await dep_paused_obj.aapply()
    print(f"Created paused deployment: {paused_id}")

if __name__ == "__main__":
    asyncio.run(main())
