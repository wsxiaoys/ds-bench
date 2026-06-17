# Serve a Prefect Flow with a Cron Schedule

## Background
Prefect allows you to easily schedule flows using the `serve` method. You can also securely manage sensitive information using `Secret` blocks.

## Requirements
- Create a Prefect `Secret` block named `my-api-key` containing the value `super-secret-value`.
- Create a Python script `/home/user/project/serve_flow.py`.
- The script must define a flow named `my_flow` that loads the `my-api-key` Secret block and prints its value.
- The script must serve the flow with the deployment name `my-deployment` and a cron schedule `0 9 * * *`.
- Run the script in the background so the deployment is actively served.

## Constraints
- Project path: `/home/user/project`
- The script must be named `/home/user/project/serve_flow.py`.