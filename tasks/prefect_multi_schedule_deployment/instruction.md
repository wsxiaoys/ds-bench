# Prefect Deployment With Three Simultaneous Schedules

## Background
You are working with a local, self-hosted Prefect 3.7.8 server (UI at http://127.0.0.1:4200, API at http://127.0.0.1:4200/api). Prefect deployments can carry more than one schedule at the same time, mixing different scheduling strategies on a single deployment. Your job is to build one deployment for one flow that runs on three different, independently-active schedules at once, each individually identifiable in the UI.

## Requirements
- Define a single flow that accepts exactly one string parameter named `channel`.
- Create exactly ONE deployment of that flow, and attach THREE schedules to it that are all active simultaneously:
  - one **cron** schedule,
  - one **interval** schedule,
  - one **rrule** (calendar recurrence) schedule.
- Each of the three schedules must be individually distinguishable in the Prefect UI by carrying its own unique slug and its own override of the flow's `channel` parameter.
- The deployment must be served locally as a long-running local process so that the server actively creates upcoming scheduled runs for it.

## Implementation Hints
- Project path: /home/user/scheduler_project
- Read the `run-id` from `/logs/artifacts/run-id` and append it as a suffix to the names below (the `run-id` value already matches `zr[a-z0-9]+`).
- Flow name: `pulse-sync-<run-id>`.
- Deployment name: `tri-cadence-<run-id>`.
- The flow's only parameter is `channel` (a string).
- Target the local server only. API URL: http://127.0.0.1:4200/api . Do not use any remote or cloud backend.
- Start command (must launch the local process that registers and serves the deployment, keeping it running): `python3 /home/user/scheduler_project/serve_deployment.py`
- The single deployment `tri-cadence-<run-id>` must have these three active schedules, each with the exact configuration below (all in the `UTC` timezone):
  - Cron schedule: cron expression exactly `17 6 * * 1`; slug exactly `weekly-cron-audit`; `channel` overridden to exactly `cron-weekly`.
  - Interval schedule: interval of exactly `900` seconds; slug exactly `interval-heartbeat`; `channel` overridden to exactly `interval-15min`.
  - Rrule schedule: rrule string exactly `FREQ=DAILY;INTERVAL=2;BYHOUR=9;BYMINUTE=30;BYSECOND=0`; slug exactly `rrule-biday-report`; `channel` overridden to exactly `rrule-biday`.
- All three schedules must be active (not paused), and upcoming/scheduled runs for the deployment must be generated and visible in the UI.
- The complete three-schedule configuration must be observable on the deployment's page in the UI at http://127.0.0.1:4200 .

