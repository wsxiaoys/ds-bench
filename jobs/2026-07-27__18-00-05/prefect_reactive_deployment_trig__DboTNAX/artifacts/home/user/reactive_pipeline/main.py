"""
Event-Driven Deployment Chaining with a Reactive Trigger (Prefect 3.7.8)

This script creates two deployments — upstream (producer) and downstream (consumer) —
and wires them together with a reactive trigger so that when the upstream flow run
reaches Completed, the downstream deployment is automatically launched.
"""

import asyncio
import os
from datetime import timedelta

from prefect import flow, serve
from prefect.automations import Posture
from prefect.client.orchestration import get_client
from prefect.deployments.runner import RunnerDeployment
from prefect.events.schemas.deployment_triggers import DeploymentEventTrigger


# ── Read the run-id suffix ──────────────────────────────────────────────
run_id_path = "/logs/artifacts/run-id"
with open(run_id_path) as f:
    run_id = f.read().strip()

UPSTREAM_FLOW_NAME = f"upstream-flow-{run_id}"
UPSTREAM_DEPLOY_NAME = f"upstream-deploy-{run_id}"
DOWNSTREAM_FLOW_NAME = f"downstream-flow-{run_id}"
DOWNSTREAM_DEPLOY_NAME = f"downstream-deploy-{run_id}"

# ── Ensure we're talking to the local server ───────────────────────────
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"


# ── Define the two flows ────────────────────────────────────────────────
@flow(name=UPSTREAM_FLOW_NAME)
def upstream_flow():
    """Upstream (producer) flow — completes successfully, no parameters."""
    print(f"[upstream] Flow '{UPSTREAM_FLOW_NAME}' running.")


@flow(name=DOWNSTREAM_FLOW_NAME)
def downstream_flow():
    """Downstream (consumer) flow — triggered automatically by upstream completion."""
    print(f"[downstream] Flow '{DOWNSTREAM_FLOW_NAME}' running.")


# ── Create deployments and automation ───────────────────────────────────
async def setup():
    """Create both deployments and wire the reactive trigger."""
    async with get_client() as client:
        # ── 1. Create the upstream flow and deployment ──────────────────
        upstream_flow_id = await client.create_flow_from_name(UPSTREAM_FLOW_NAME)

        upstream_deployment_id = await client.create_deployment(
            flow_id=upstream_flow_id,
            name=UPSTREAM_DEPLOY_NAME,
        )
        print(f"[setup] Upstream deployment created: {upstream_deployment_id}")

        # ── 2. Create the downstream flow and deployment ────────────────
        downstream_flow_id = await client.create_flow_from_name(DOWNSTREAM_FLOW_NAME)

        downstream_deployment_id = await client.create_deployment(
            flow_id=downstream_flow_id,
            name=DOWNSTREAM_DEPLOY_NAME,
        )
        print(f"[setup] Downstream deployment created: {downstream_deployment_id}")

        # ── 3. Build the reactive trigger ───────────────────────────────
        # The trigger fires when a flow run of the *upstream* deployment
        # reaches the Completed state.
        trigger = DeploymentEventTrigger(
            name=f"{DOWNSTREAM_DEPLOY_NAME}__reactive_trigger",
            description=(
                f"Automatically run {DOWNSTREAM_DEPLOY_NAME} when "
                f"{UPSTREAM_DEPLOY_NAME} completes."
            ),
            enabled=True,
            expect={"prefect.flow-run.Completed"},
            match={"prefect.resource.id": "prefect.flow-run.*"},
            match_related={
                "prefect.resource.id": f"prefect.deployment.{upstream_deployment_id}"
            },
            posture=Posture.Reactive,
            threshold=1,
            within=timedelta(seconds=0),
        )

        # The trigger's set_deployment_id tells it which deployment to run
        # (the downstream) when the trigger fires.
        trigger.set_deployment_id(downstream_deployment_id)

        # ── 4. Create the automation on the server ──────────────────────
        automation = trigger.as_automation()
        automation_id = await client.create_automation(automation)
        print(f"[setup] Automation created: {automation_id}")

        return upstream_deployment_id, downstream_deployment_id


def main():
    """Entry point: set up deployments + automation, then serve both flows."""

    # Run the async setup to create deployments and the automation
    upstream_id, downstream_id = asyncio.run(setup())

    # Build RunnerDeployment objects for serving.
    # We use to_deployment() which returns a RunnerDeployment ready to serve.
    upstream_deploy = upstream_flow.to_deployment(name=UPSTREAM_DEPLOY_NAME)
    downstream_deploy = downstream_flow.to_deployment(name=DOWNSTREAM_DEPLOY_NAME)

    print(f"\n[serve] Serving both deployments locally...")
    print(f"  Upstream:   {UPSTREAM_FLOW_NAME} / {UPSTREAM_DEPLOY_NAME}")
    print(f"  Downstream: {DOWNSTREAM_FLOW_NAME} / {DOWNSTREAM_DEPLOY_NAME}")
    print(f"  Trigger:    upstream.Completed → downstream (reactive)\n")

    serve(upstream_deploy, downstream_deploy)


if __name__ == "__main__":
    main()
