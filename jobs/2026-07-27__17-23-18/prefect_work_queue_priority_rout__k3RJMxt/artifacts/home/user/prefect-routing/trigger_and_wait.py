import asyncio
import sys
from prefect import get_client

async def main():
    # Read run-id
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
    
    deployments = [
        f"routing-flow/critical-deploy-{run_id}",
        f"routing-flow/standard-deploy-{run_id}",
        f"routing-flow/bulk-deploy-{run_id}"
    ]
    
    client = get_client()
    flow_run_ids = []
    
    print("Triggering flow runs...")
    for dep_name in deployments:
        dep = await client.read_deployment_by_name(dep_name)
        flow_run = await client.create_flow_run_from_deployment(dep.id)
        flow_run_ids.append(flow_run.id)
        print(f"Triggered run {flow_run.name} ({flow_run.id}) for deployment {dep_name}")
    
    print("Waiting for runs to complete...")
    while True:
        await asyncio.sleep(2)
        all_final = True
        all_completed = True
        
        for fr_id in flow_run_ids:
            fr = await client.read_flow_run(fr_id)
            if not fr.state or not fr.state.is_final():
                all_final = False
                all_completed = False
                break
            if not fr.state.is_completed():
                all_completed = False
        
        if all_final:
            if all_completed:
                print("All flow runs completed successfully!")
                sys.exit(0)
            else:
                print("Some flow runs did not complete successfully.")
                sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
