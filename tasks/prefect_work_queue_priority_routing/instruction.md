# Prioritized Work-Queue Routing on a Prefect Work Pool

## Background
You are operating a **local, self-hosted Prefect 3.4.25** control plane. A Prefect server (UI + API) runs on this machine and is reachable at UI `http://127.0.0.1:4200` and API `http://127.0.0.1:4200/api`. Your job is to build a single work pool whose internal topology of prioritized, concurrency-bounded work queues routes different classes of deployments to different queues, and to make real runs flow through that topology to completion — all observable in the local Prefect UI.

## Requirements
- Build ONE local process-type work pool that contains exactly three additional work queues, each with a distinct priority and its own per-queue concurrency limit.
- Create three deployments of your workflow(s), each one bound so that its runs are delivered through one specific named queue (one deployment per queue).
- Actually execute the workflows locally so that one run of every deployment is dispatched through its intended queue and finishes successfully.
- The entire topology and the finished runs must be inspectable in the local Prefect UI.

## Implementation Hints
- Project path: /home/user/prefect-routing
- Read the `run-id` from `/logs/artifacts/run-id` and append it (verbatim) as a suffix to every collision-prone name described below.
- The local Prefect server is authoritative; the UI is `http://127.0.0.1:4200` and the API is `http://127.0.0.1:4200/api`. All work must target this local server (no remote or cloud backend).
- The work pool MUST be named `routing-pool-<run-id>` and MUST be of the local process execution type.
- Inside that pool, beyond any default queue, there MUST be exactly these three work queues, with exactly these priority values and per-queue concurrency limits:
  - `critical-<run-id>` — priority `1`, concurrency limit `1`
  - `standard-<run-id>` — priority `5`, concurrency limit `3`
  - `bulk-<run-id>` — priority `10`, concurrency limit `5`
- There MUST be exactly three deployments, each routed to one queue:
  - `critical-deploy-<run-id>` routed through queue `critical-<run-id>`
  - `standard-deploy-<run-id>` routed through queue `standard-<run-id>`
  - `bulk-deploy-<run-id>` routed through queue `bulk-<run-id>`
- Provide a single, idempotent, safely re-runnable entrypoint at `/home/user/prefect-routing/run.sh`. When executed against the already-running local server, it must build the pool and its three queues (with the exact priorities and concurrency limits above), register the three deployments bound to their queues, submit exactly one run of each deployment, drive those runs to completion via a local worker, and exit `0` only after all three runs have finished successfully.
- On the UI Work Pools view, the pool `routing-pool-<run-id>` must be present and show its three queues with the correct priorities and concurrency limits. On the Flow Runs view, the run produced by each deployment must have reached the terminal `Completed` state, and each deployment must remain associated with its intended queue.

