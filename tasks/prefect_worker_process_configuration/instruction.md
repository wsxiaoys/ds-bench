# Configure Prefect Worker Process Deployment

## Background
You have a Prefect project at `/home/user/myproject`. There is a flow defined in `flows/data_pipeline.py` with the function `my_flow`. To execute this flow using a worker, you need to configure a deployment using `prefect.yaml` and set up a work pool.

## Requirements
- Initialize a Prefect project in `/home/user/myproject` using `prefect init`.
- Create a Prefect work pool named `local-work-pool` of type `process`.
- Configure the deployment in `prefect.yaml`:
  - Name the deployment `pipeline-deployment`.
  - Set the entrypoint to `flows/data_pipeline.py:my_flow`.
  - Assign it to the `local-work-pool`.
- Deploy the flow using the configuration.
- Start a worker for `local-work-pool` in the background, redirecting its output to `/home/user/myproject/worker.log`.

## Implementation Guide
1. Navigate to `/home/user/myproject`.
2. Run `prefect init` to generate a `prefect.yaml` file if it doesn't exist.
3. Use the Prefect CLI to create a work pool named `local-work-pool` of type `process`: `prefect work-pool create local-work-pool --type process`.
4. Edit `prefect.yaml` to define a deployment named `pipeline-deployment` with the entrypoint `flows/data_pipeline.py:my_flow` and work pool `local-work-pool`.
5. Run `prefect deploy --all --no-prompt` to register the deployment.
6. Start the worker in the background: `prefect worker start -p local-work-pool > /home/user/myproject/worker.log 2>&1 &`.

## Constraints
- Project path: `/home/user/myproject`
- Log file: `/home/user/myproject/worker.log`
- Use Prefect CLI to create work pool, deploy, and start worker.