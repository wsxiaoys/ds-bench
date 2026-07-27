"""
Deploy all four flows to the local Prefect server.

Each flow is registered with its run-id suffix appended to the base name.
"""

import os
import sys
import asyncio

# Ensure we use the local server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

from prefect import get_client

from flows import (
    charge_settlement,
    billing_rollup,
    inventory_sync,
    orders_pipeline,
)


def read_run_id():
    with open("/logs/artifacts/run-id") as f:
        return f.read().strip()


async def deploy():
    run_id = read_run_id()

    # Map of flow function -> base name
    flow_map = {
        charge_settlement: "charge-settlement",
        billing_rollup: "billing-rollup",
        inventory_sync: "inventory-sync",
        orders_pipeline: "orders-pipeline",
    }

    async with get_client() as client:
        for flow_fn, base_name in flow_map.items():
            deployment_name = f"{base_name}-{run_id}"

            # Create the flow record on the server
            flow_id = await client.create_flow(flow_fn)
            print(f"Created flow: {flow_fn.name} (id={flow_id})")

            # Create the deployment
            deployment_id = await client.create_deployment(
                flow_id=flow_id,
                name=deployment_name,
                paused=False,
                parameters={},
            )
            print(f"  -> Deployment: {deployment_name} (id={deployment_id})")


if __name__ == "__main__":
    asyncio.run(deploy())
