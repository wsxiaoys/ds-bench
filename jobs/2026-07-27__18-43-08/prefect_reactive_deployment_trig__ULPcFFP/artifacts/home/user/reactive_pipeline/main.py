"""
Event-driven deployment chaining with a reactive trigger (Prefect 3.7.8).

Defines two flows (upstream/downstream), builds a local deployment for each,
attaches a reactive DeploymentEventTrigger to the downstream deployment so it
is launched automatically the moment the upstream deployment's flow run
reaches the `Completed` state, and serves both deployments locally so their
runs actually execute.
"""

import pathlib

from prefect import flow, serve
from prefect.events import DeploymentEventTrigger

RUN_ID = pathlib.Path("/logs/artifacts/run-id").read_text().strip()

UPSTREAM_FLOW_NAME = f"upstream-flow-{RUN_ID}"
UPSTREAM_DEPLOY_NAME = f"upstream-deploy-{RUN_ID}"
DOWNSTREAM_FLOW_NAME = f"downstream-flow-{RUN_ID}"
DOWNSTREAM_DEPLOY_NAME = f"downstream-deploy-{RUN_ID}"


@flow(name=UPSTREAM_FLOW_NAME, log_prints=True)
def upstream_flow() -> None:
    print(f"Running upstream flow '{UPSTREAM_FLOW_NAME}'")


@flow(name=DOWNSTREAM_FLOW_NAME, log_prints=True)
def downstream_flow() -> None:
    print(f"Running downstream flow '{DOWNSTREAM_FLOW_NAME}' (auto-triggered)")


def build_deployments():
    upstream_deployment = upstream_flow.to_deployment(
        name=UPSTREAM_DEPLOY_NAME,
    )

    # Reactive trigger: fire the instant a flow run of the *upstream*
    # deployment reaches the Completed terminal state. No schedule, no
    # polling -- purely event driven, configured on the downstream
    # deployment itself.
    downstream_trigger = DeploymentEventTrigger(
        expect={"prefect.flow-run.Completed"},
        match_related={
            "prefect.resource.name": UPSTREAM_DEPLOY_NAME,
            "prefect.resource.role": "deployment",
        },
    )

    downstream_deployment = downstream_flow.to_deployment(
        name=DOWNSTREAM_DEPLOY_NAME,
        triggers=[downstream_trigger],
    )

    return upstream_deployment, downstream_deployment


if __name__ == "__main__":
    upstream_deployment, downstream_deployment = build_deployments()

    # Registers both deployments on the local Prefect server and keeps the
    # process alive, polling the local work pool-less runner so that
    # triggered/started runs actually execute on this process.
    serve(upstream_deployment, downstream_deployment)
