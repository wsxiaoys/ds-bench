# Late and Paused Scheduled Runs on a Self-Hosted Prefect Server

## Background
You are working with **Prefect 3.8.0** orchestrating against a **self-hosted Prefect server** that is already running locally. The server UI is served at `http://127.0.0.1:4200` and its API at `http://127.0.0.1:4200/api`. Everything must stay local; no Prefect Cloud or any other external service may be used.

A data team wants a reproducible "scheduling lab" that demonstrates two distinct points in a deployment's scheduling lifecycle at the same time: one deployment whose scheduled work is piling up because nothing is executing it, and a second deployment whose schedule has been deliberately switched off. Both situations must be plainly visible in the Prefect UI.

## Requirements
- Define a single Prefect flow and register **two deployments** of it against the local server.
- One deployment must be actively scheduled so that its scheduled work becomes overdue and surfaces in the UI accordingly.
- The other deployment must carry a schedule that has been turned off, so the UI shows it as inactive with nothing queued ahead.
- The whole setup must be reproducible from a single command that leaves the server in the required state.

## Implementation Hints
- Prefect version: **3.8.0** (already installed). Target only the local server at `http://127.0.0.1:4200` (API `http://127.0.0.1:4200/api`).
- Project path: `/home/user/scheduling_lab`.
- Read the `run-id` from `/logs/artifacts/run-id` and append it to every deployment name so names are unique per run.
- Provide an idempotent setup command **`bash setup.sh`** (run from `/home/user/scheduling_lab`) that (re)creates both deployments and leaves them in the exact required states described below. Re-running it must converge to the same final state.
- Both deployments belong to one flow. Their names must be exactly:
  - `pulse-active-<run-id>` — carries an **active** schedule that fires on a fixed **30-second interval**. Within the observation window, at least one flow run of this deployment must be visible in the Prefect UI in the **Late** state.
  - `pulse-paused-<run-id>` — carries a schedule that must end in a **paused (inactive)** state, so the UI shows its schedule switched off with **no upcoming runs**.
- Neither deployment may have any of its scheduled runs actually executed; the scheduled work for `pulse-active-<run-id>` must remain waiting so that it surfaces as Late rather than progressing to running or completed.
- Do not create or leave running anything that would consume and execute these scheduled runs.

