# Prefect Event-Driven Automation

## Background
Prefect 3.0 supports event-driven automations. You can configure a deployment to trigger a flow run when a specific external event occurs, such as a file upload or a webhook payload.

## Requirements
- Create a Prefect flow named `webhook-flow` in `/home/user/project/flow.py` that accepts an optional `payload` parameter (defaulting to an empty dict) and prints `"Received event payload"`.
- Use `flow.serve()` to serve this flow as a deployment named `event-deployment`.
- The deployment must be configured with an event trigger that listens for the event `custom.webhook.received`.
- The trigger must require the event to have the resource ID `prefect.resource.id=my.webhook.resource`.
- Ensure the server is running on `127.0.0.1:4200` and the deployment is actively polling.

## Implementation Guide
1. Ensure the Prefect server is running locally on port 4200.
2. In `/home/user/project/flow.py`, define the flow and use `from prefect.events import DeploymentEventTrigger` to configure the `triggers` parameter of `flow.serve()`.
3. Serve the flow in a background process or another terminal session so it can listen for events.

## Constraints
- Project path: `/home/user/project`
- Flow file: `/home/user/project/flow.py`
- The flow name must be `webhook-flow`.
- The deployment name must be exactly `event-deployment`.
- The trigger must expect the event `custom.webhook.received`.
- The trigger must match the resource `prefect.resource.id` to `my.webhook.resource`.