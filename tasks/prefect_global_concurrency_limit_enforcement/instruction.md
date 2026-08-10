# Prefect Global Concurrency Limit Enforcement

## Background
Prefect is a Python workflow orchestration framework. This task uses a self-hosted Prefect server running locally (the UI and API are already expected to be reachable at the addresses below). You must build a workflow that strictly bounds how many units of work run at the same time using a single, named, server-side global concurrency limit whose enforcement is coordinated by the Prefect server.

## Requirements
- Build a Prefect pipeline that ensures a named global concurrency limit exists on the local server with a fixed number of available slots.
- The pipeline launches many units of work at once. The named limit must strictly bound how many of those units execute simultaneously.
- Units that cannot immediately proceed under the limit must wait for capacity rather than fail or error out. Every unit must eventually finish successfully.
- All results must be observable in the local Prefect UI.

## Implementation Hints
- Project path: /home/user/gcl_pipeline
- Start command (run from the project path): `python3 main.py`
- The pipeline must target the local Prefect server ONLY. API base URL: http://127.0.0.1:4200/api ; UI: http://127.0.0.1:4200 . Do not use any external, remote, or cloud service, and do not require any credentials.
- Read the `run-id` from `/logs/artifacts/run-id` and append it to the collision-prone names described below.
- The global concurrency limit must be named exactly `throughput-guard-<run-id>`, must be active, and must expose exactly 2 slots.
- The workflow must launch exactly 8 units of work. Each unit must appear as its own independent flow run whose flow is named exactly `payload-unit-<run-id>`.
- Each unit must occupy one slot of `throughput-guard-<run-id>` for the entire duration of its work, such that at no moment do more than 2 units run at the same time; any unit that cannot acquire a slot must wait until one frees up instead of failing.
- Running the start command once must both (a) ensure the limit `throughput-guard-<run-id>` exists on the local server with its 2 slots, and (b) launch and drive all 8 units to completion. After it returns, the local Prefect UI must show the limit with its 2 slots on the Concurrency page, and exactly 8 `payload-unit-<run-id>` flow runs, every one of them in the Completed state, on the Runs (Flow Runs) page.

