import os
from prefect import flow, serve
from prefect.events import DeploymentEventTrigger

# Run ID suffix
RUN_ID = "zrwydi2yve"

# Upstream Flow
@flow(name=f"upstream-flow-{RUN_ID}", log_prints=True)
def upstream_flow():
    print("Upstream flow executed successfully.")

# Downstream Flow
@flow(name=f"downstream-flow-{RUN_ID}", log_prints=True)
def downstream_flow():
    print("Downstream flow executed successfully.")

if __name__ == "__main__":
    # Create upstream deployment
    upstream_deployment = upstream_flow.to_deployment(
        name=f"upstream-deploy-{RUN_ID}"
    )
    
    # Create downstream deployment with reactive trigger
    downstream_deployment = downstream_flow.to_deployment(
        name=f"downstream-deploy-{RUN_ID}",
        triggers=[
            DeploymentEventTrigger(
                expect={"prefect.flow-run.Completed"},
                match_related={
                    "prefect.resource.role": "deployment",
                    "prefect.resource.name": f"upstream-deploy-{RUN_ID}"
                }
            )
        ]
    )
    
    print(f"Serving deployments: upstream-deploy-{RUN_ID} and downstream-deploy-{RUN_ID}")
    serve(upstream_deployment, downstream_deployment)
