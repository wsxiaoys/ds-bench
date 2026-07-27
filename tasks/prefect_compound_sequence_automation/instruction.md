# Event-Driven Prefect Automation Gated by Two Ordered Events

## Background
You are working with a locally running **Prefect 3.4.25** server (open-source). Prefect's automation system can watch the stream of events flowing through the local server and take an action when a condition is met. In this task you must build an automation whose action is gated behind **more than one** distinct event, so that a single event is never enough to trigger it. The whole setup must live entirely on the local server (no Prefect Cloud, no external services).

## Requirements
- Bring up a local Prefect server and make sure its UI and API are reachable on port `4200`.
- Register a runnable deployment on the local server that the automation can launch.
- Create exactly one automation on the local server that:
  - stays idle when only one of its two required events has been seen, and
  - carries out its action **only after both required events have been observed, and only if the first required event was observed strictly before the second** (a single event, or the two events observed in the wrong order, must not cause the action to run);
  - when it does fire, its action starts a run of your registered deployment.
- Everything (the automation, its trigger configuration, the deployment, and the flow run produced when the automation fires) must be visible in the Prefect UI.

## Implementation Hints
- Project path: `/home/user/prefect_seq`
- The Prefect server must be reachable at UI `http://127.0.0.1:4200` and API `http://127.0.0.1:4200/api` (bind to `127.0.0.1`, port `4200`).
- Read the `run-id` from `/logs/artifacts/run-id` and append it to the collision-prone names below.
- The deployment must be named exactly `guarded-export-<run-id>` and must be launchable by the automation's action.
- The automation must be named exactly `seq-guard-automation-<run-id>`.
- The two events the automation waits for are custom events emitted onto the local server with these exact names, in this required order:
  1. first event name: `zealt.export.staged.<run-id>`
  2. second event name: `zealt.export.approved.<run-id>`
  Both events are emitted with the primary resource id `zealt.export.<run-id>`.
- The automation must fire only once both of those events have been observed and only when `zealt.export.staged.<run-id>` occurred before `zealt.export.approved.<run-id>`; when it fires, its action must start a run of the `guarded-export-<run-id>` deployment.
- The automation, the deployment, and any flow run produced when the automation fires must all be discoverable in the Prefect UI at `http://127.0.0.1:4200`.
- You do NOT need to emit the two events yourself; correctness is judged by configuring the automation and deployment so that, when those two events arrive in the correct order, a new run of `guarded-export-<run-id>` is created and appears in the UI.

