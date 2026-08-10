# Event-Driven Deployment Chaining with a Reactive Trigger (Prefect 3.7.8)

## Background
You are building an event-driven orchestration on a **locally self-hosted Prefect 3.7.8** instance. A Prefect server is already running locally and reachable at the UI `http://127.0.0.1:4200` and the API `http://127.0.0.1:4200/api`. No Prefect Cloud, and no external network service, may be used.

You must wire together two separate workflows so that finishing the first one automatically launches the second one — without any schedule, without polling code of your own, and without a human (or a script) manually starting the second workflow. The link between them must be driven entirely by Prefect's own event system, configured **on the downstream deployment itself**.

## Requirements
- Create two distinct flows and expose each as its own local deployment on the running Prefect server:
  - an **upstream (producer)** deployment, and
  - a **downstream (consumer)** deployment.
- The downstream deployment must carry a **reactive trigger** so that it is launched automatically the moment a flow run of the **upstream** deployment reaches the **`Completed`** terminal state. The downstream deployment must NOT be started manually, on a schedule, or by any custom polling code — its run must be produced solely by the reactive trigger reacting to the upstream completion event.
- Both deployments must remain servable/executable locally so that, once triggered, their runs actually execute to completion on the local process (no external work pool or remote infrastructure).
- Running the upstream deployment exactly once must result in **exactly one** downstream flow run being created automatically and finishing in the **`Completed`** state, with the causal link between the two runs observable in the Prefect UI.

## Implementation Hints
- Project path: `/home/user/reactive_pipeline`
- The local Prefect server is already running; the environment is preconfigured so the API is `http://127.0.0.1:4200/api` (UI at `http://127.0.0.1:4200`). Do not point Prefect at any remote/cloud API.
- Read the `run-id` from `/logs/artifacts/run-id` and append it as a suffix to every collision-prone name below (a `run-id` looks like `zr` followed by lowercase letters/digits).
- Use these exact names (with the `run-id` suffix applied):
  - Upstream flow name: `upstream-flow-${run-id}`
  - Upstream deployment name: `upstream-deploy-${run-id}`
  - Downstream flow name: `downstream-flow-${run-id}`
  - Downstream deployment name: `downstream-deploy-${run-id}`
- Neither flow needs parameters; each flow only has to run and finish successfully (reach `Completed`).
- Start command (run from the project directory; it must register both deployments on the local server and keep serving them so their runs execute): `python3 main.py`
- The reactive trigger must fire specifically on the upstream deployment's flow run reaching `Completed` — not on a schedule and not on any other state.
- Success is defined entirely by what is visible in the local Prefect UI at `http://127.0.0.1:4200`: both deployments present, the downstream deployment's reactive trigger configured, and — after the upstream deployment is run once and completes — an automatically-created downstream flow run that reached `Completed`.

