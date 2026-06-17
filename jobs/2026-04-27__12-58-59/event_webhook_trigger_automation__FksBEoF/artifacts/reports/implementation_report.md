# Prefect Event-Driven Automation Report

## Summary
Implemented a Prefect flow that listens for external events to trigger runs.

## Details
- **Flow Name**: `webhook-flow`
- **Deployment Name**: `event-deployment`
- **Trigger Event**: `custom.webhook.received`
- **Resource ID Match**: `prefect.resource.id=my.webhook.resource`
- **Server Address**: `127.0.0.1:4200`

## Components
1. **Prefect Server**: Started in background on port 4200.
2. **Flow Script**: Created at `/home/user/project/flow.py`.
3. **Deployment**: Served via `flow.serve()` with a `DeploymentEventTrigger`.

## Verification
The flow is actively polling for runs and configured with the specified event trigger.
