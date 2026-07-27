# Force Prefect Flow Runs Into Assigned Final States

## Background
Prefect 3.x orchestrates Python workflows on a locally hosted server that exposes both a REST API and a web UI. Beyond simply executing flows, Prefect lets a run's state be managed through its server-side interface, independent of whatever outcome the run's code would produce on its own. In this task you will drive several runs of a single flow into a precise, predetermined set of final states and make those states visible in the local UI.

## Requirements
- Run a locally hosted Prefect server (UI + API) and use only that local server.
- Define a single flow and produce exactly four runs of it.
- Each of the four runs must ultimately settle in a specific, assigned final state, even when that state differs from the outcome the run's own execution would otherwise yield.
- The assigned final states must be the persisted states shown for each run in the Prefect UI.

## Implementation Hints
- Project path: /home/user/state_forcing
- Use Prefect version 3.4.25.
- The Prefect server must be reachable locally with the UI at http://127.0.0.1:4200 and the API at http://127.0.0.1:4200/api. Do not use any remote, hosted, or cloud service.
- Read the `run-id` from `/logs/artifacts/run-id` and append it as a suffix to every flow name and flow-run name described below (substitute it wherever `<run-id>` appears).
- All four runs must belong to a single flow named `state-forcing-flow-<run-id>`.
- Create exactly four runs of that flow. Each run name is unique and each run must end in exactly the state listed next to it:
  - `ingest-<run-id>` → Completed
  - `transform-<run-id>` → Failed
  - `validate-<run-id>` → Cancelled
  - `publish-<run-id>` → Crashed
- The four runs share the same single flow yet must display four different final states. Reaching a state that the run's own execution would not naturally produce must be accomplished through Prefect's server-side interface (its API / client), not by tailoring the flow's code so it happens to end that way.
- The four assigned states must remain persisted and individually visible for each named run on the Prefect UI Flow Runs page (http://127.0.0.1:4200/runs) while the server is running.

