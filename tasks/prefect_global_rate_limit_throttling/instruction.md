# Throttle a Repeated Workload With Prefect Throughput Controls

## Background
A data platform must call a fictional external "partner API" that tolerates only a slow, paced stream of requests. You will use **Prefect 3.x** (pinned to version `3.4.25`) running entirely against a **local, self-hosted Prefect server** to build a workflow whose repeated executions are *throttled over time* — not merely capped at a fixed number of simultaneous runs. The throttling must be driven by a named throughput-control resource whose permits regenerate gradually, so a burst of work is spread out yet every unit still finishes.

Everything runs locally. There is no Prefect Cloud, no external network service, and no credentials of any kind.

## Requirements
- Stand up and use a **local Prefect server** (UI + API) on the loopback interface.
- Define a single named **throughput-control resource** whose configuration causes repeated entries into it to be *paced across time* (a small pool of permits that continuously replenishes at a fixed per-second rate), as opposed to a fixed pool that only limits simultaneous holders.
- Build a flow that performs one identical unit of work, and drive it so that a fixed number of these units are dispatched. Each unit must pass through the throughput-control resource so the batch is throttled (spread out over time), yet **every** unit must ultimately finish successfully.
- The resource's configuration and the fully-completed batch must both be visible in the local Prefect UI.

## Implementation Hints
- Project path: `/home/user/prefect-throttle`.
- Read the trial identifier from `/logs/artifacts/run-id` and append it (exactly, unmodified) as a suffix to every collision-prone name described below.
- The local Prefect server must be reachable at UI `http://127.0.0.1:4200` and API `http://127.0.0.1:4200/api` (port **4200**, host **127.0.0.1** only).
- The throughput-control resource must be named exactly `partner-api-throttle-<run-id>` and must be configured with:
  - a permit ceiling (maximum simultaneously-held permits) of exactly **4**, and
  - a permit replenishment rate of exactly **1.5** permits per second (the rate at which held permits are returned to the pool over time).
  Both of these exact values must be readable for this resource on the Prefect UI's concurrency view, and the resource must be in the active/enabled state.
- The flow must be named exactly `throttled-dispatch-<run-id>`.
- Exactly **12** work units must be dispatched, producing **12** flow runs of `throttled-dispatch-<run-id>`, and **all 12** must reach the `Completed` state.
- Provide a single rerunnable entrypoint at `/home/user/prefect-throttle/throttle.py` invoked as `python3 throttle.py`. Running it must (a) ensure the throughput-control resource exists with the exact configuration above, and (b) dispatch the 12 throttled work units to completion against the local server. Re-invocation must not error on an already-existing resource.
- Final observable outcome: the Prefect UI concurrency view shows `partner-api-throttle-<run-id>` with a permit ceiling of `4` and a replenishment rate of `1.5` per second and an active status; and the Prefect UI flow-runs view shows 12 runs of `throttled-dispatch-<run-id>`, every one of them `Completed`.

