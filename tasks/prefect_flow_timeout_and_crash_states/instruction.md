# Prefect Flow Terminal-State Taxonomy: TimedOut vs Crashed vs Failed

## Background
Prefect 3.x records every flow run's outcome as a terminal state, and the local Prefect UI distinguishes between the different ways a run can end unsuccessfully. Your job is to build a set of Prefect flows whose runs deterministically land in three *different, non-Completed* terminal states so that an operator inspecting the local UI can immediately tell the failure modes apart.

Everything runs locally. A Prefect OSS server (UI and API) runs on this machine; you must point your work at it and produce the runs there.

## Requirements
- Build a Python project that defines and executes three separate Prefect flows against the local Prefect server.
- Each of the three flows, when run, must produce a flow run that ends in a **distinct** terminal state, and each of those states must be one of: **TimedOut**, **Crashed**, **Failed**.
- Exactly one flow is responsible for each of those three outcomes:
  - a flow whose run ends in the **TimedOut** state,
  - a flow whose run ends in the **Crashed** state,
  - a flow whose run ends in the **Failed** state.
- The three outcomes are genuinely different terminal states in Prefect's state taxonomy; producing the same underlying state for two of the flows does not satisfy the task. In particular the **Crashed** outcome must be a true infrastructure-level interruption of the run, not an ordinary exception raised in your workflow code (an ordinary raised exception is what the **Failed** flow must produce), and the **TimedOut** outcome must be the result of the run exceeding its allotted maximum runtime.
- Every resulting flow run must be recorded on the local Prefect server so that it is visible on the UI Flow Runs page with its terminal state.

## Implementation Hints
- Project path: `/home/user/flow_states`.
- The local Prefect server API is at `http://127.0.0.1:4200/api` and its UI is at `http://127.0.0.1:4200`. All flow runs you create must be registered with this server (do not use any external or cloud service).
- Read the `run-id` from `/logs/artifacts/run-id` and append it to each flow's name to avoid collisions. The three flows must be named exactly:
  - `timeout-flow-<run-id>` — its run must end in the **TimedOut** state.
  - `crash-flow-<run-id>` — its run must end in the **Crashed** state.
  - `failure-flow-<run-id>` — its run must end in the **Failed** state.
  (Replace `<run-id>` with the exact contents of `/logs/artifacts/run-id`.)
- The `timeout-flow-<run-id>` flow must be constrained to a maximum runtime of exactly **5 seconds**, and it must attempt work that takes longer than that so the run is aborted and finishes as **TimedOut**.
- Provide an executable entrypoint at `/home/user/flow_states/run_all.py` that can be run with `python3 run_all.py` from the project path. Running it must produce (or reproduce) the three required flow runs — one per flow — each ending in its required terminal state on the local server, and it must reliably produce all three even though one of them does not end normally.
- You must actually execute all three flows so that one flow run per flow exists on the server, each in its required terminal state, and each is listed on the Flow Runs page of the UI at `http://127.0.0.1:4200`.
- The flow-run names shown in the UI must clearly associate each run with its flow name above so the three outcomes can be told apart.

