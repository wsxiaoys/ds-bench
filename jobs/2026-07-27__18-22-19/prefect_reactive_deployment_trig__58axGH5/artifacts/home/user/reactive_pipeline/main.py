"""Event-driven deployment chaining with a reactive trigger (Prefect 3.7.8).

Two flows are served as local deployments on the running Prefect server:

* ``upstream-flow``   -> ``upstream-deploy``   (the producer)
* ``downstream-flow`` -> ``downstream-deploy`` (the consumer)

The downstream deployment carries a *reactive* trigger that fires the moment a
flow run of the **upstream** deployment reaches the ``Completed`` terminal state.
The downstream run is therefore created automatically by Prefect's own event
system -- not by a schedule, not by polling code, and not by a human.

Running ``python3 main.py`` registers both deployments on the local server and
keeps serving them so their runs execute locally (in subprocesses spawned by the
Runner, with no external work pool or remote infrastructure).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from prefect import flow
from prefect.events.schemas.automations import Posture
from prefect.events.schemas.deployment_triggers import DeploymentEventTrigger
from prefect.runner import Runner

# Read the run-id that makes every collision-prone name unique.
RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()

UPSTREAM_FLOW_NAME = f"upstream-flow-{RUN_ID}"
UPSTREAM_DEPLOY_NAME = f"upstream-deploy-{RUN_ID}"

DOWNSTREAM_FLOW_NAME = f"downstream-flow-{RUN_ID}"
DOWNSTREAM_DEPLOY_NAME = f"downstream-deploy-{RUN_ID}"


@flow(name=UPSTREAM_FLOW_NAME)
def upstream_flow() -> str:
    """The producer flow. It only has to run and finish successfully."""
    return "upstream completed"


@flow(name=DOWNSTREAM_FLOW_NAME)
def downstream_flow() -> str:
    """The consumer flow. It only has to run and finish successfully."""
    return "downstream completed"


async def main() -> None:
    # A single Runner serves both deployments locally.
    runner = Runner(name=f"reactive-pipeline-{RUN_ID}")

    # 1. Register the upstream (producer) deployment first so we obtain its
    #    deployment id, which the downstream trigger must reference.
    upstream_deployment_id = await runner.aadd_flow(
        upstream_flow,
        name=UPSTREAM_DEPLOY_NAME,
    )

    # 2. Build a *reactive* trigger that fires exclusively when a flow run of
    #    the upstream deployment reaches the ``Completed`` terminal state.
    #    The deployment is a *related* resource (role "deployment") of the
    #    ``prefect.flow-run.Completed`` event, so we scope the trigger with
    #    ``match_related`` on that deployment's resource id.
    completion_trigger = DeploymentEventTrigger(
        name=f"chain-downstream-on-upstream-completed-{RUN_ID}",
        enabled=True,
        posture=Posture.Reactive,
        expect={"prefect.flow-run.Completed"},
        match_related={
            "prefect.resource.role": "deployment",
            "prefect.resource.id": f"prefect.deployment.{upstream_deployment_id}",
        },
    )

    # 3. Register the downstream (consumer) deployment carrying the trigger.
    await runner.aadd_flow(
        downstream_flow,
        name=DOWNSTREAM_DEPLOY_NAME,
        triggers=[completion_trigger],
    )

    # 4. Serve both deployments forever: the Runner polls for scheduled runs of
    #    its deployments and executes them locally.
    await runner.start()


if __name__ == "__main__":
    asyncio.run(main())