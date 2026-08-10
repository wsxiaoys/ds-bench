# Serialize a Hot Resource with Two Combined Prefect Concurrency Controls

## Background
You are hardening a Prefect 3.x data pipeline (Prefect version `3.4.25`, self-hosted server) that fans out many identical units of work at once. Every unit touches a single shared "hot" resource that becomes corrupted if two units enter its critical section simultaneously, so that critical section must be strictly serialized. At the same time, the overall pipeline must not overwhelm the machine, so total parallelism has to be capped independently of the serialization guarantee. You must combine two *different* Prefect concurrency mechanisms so that both constraints hold at the same time, and every unit still finishes successfully.

A local Prefect server (UI at `http://127.0.0.1:4200`, API at `http://127.0.0.1:4200/api`) is already running in the environment; use it as the single source of truth. No external or cloud services are involved.

## Requirements
- Read the value of `run-id` from `/logs/artifacts/run-id` and append it to every collision-prone name described below, exactly as specified.
- Register, on the local server, a task-run concurrency limit on the tag `hotpath-<run-id>` whose maximum number of simultaneously running tagged task runs is exactly `1`.
- Register, on the local server, a separately-named global concurrency limit called `throughput-<run-id>` whose number of slots is exactly `3`.
- Build a flow named `guarded_pipeline_<run-id>` that represents one unit of work. Each unit must:
  - perform a critical section against the hot resource that is protected by the `hotpath-<run-id>` tag concurrency limit, so that no more than one critical section is ever in a Running state across all concurrent units, and
  - perform broader processing that is bounded by the `throughput-<run-id>` global concurrency limit, so that overall parallelism never exceeds its slot count.
- Provide a runnable entrypoint that launches exactly `12` concurrent units of `guarded_pipeline_<run-id>` at once. Under the two controls above, every one of the 12 units must eventually reach the `Completed` state (i.e. the combined enforcement serializes the hot resource and caps parallelism without deadlocking).
- Both concurrency controls and the 12 completed units must be observable in the local Prefect UI.

## Implementation Hints
- Project path: `/home/user/concurrency_guard`
- Local Prefect server UI: `http://127.0.0.1:4200` ; API: `http://127.0.0.1:4200/api` (host `127.0.0.1` only).
- Runnable entrypoint (invoked from the project path): `python3 run.py`. A single invocation must launch exactly 12 concurrent units.
- Exact names (each suffixed with the `run-id` read from `/logs/artifacts/run-id`):
  - Tag for the serialized critical section: `hotpath-<run-id>`, with a task-run concurrency limit of exactly `1`.
  - Global concurrency limit name: `throughput-<run-id>`, with exactly `3` slots.
  - Flow name: `guarded_pipeline_<run-id>`.
- Exactly `12` concurrent units per run; the final-state invariant is that all `12` units reach `Completed`, which is only possible if the two controls are configured correctly and do not deadlock.
- The two concurrency controls must be created and persisted on the server independently of executing the workload; do not run the entrypoint yourself — the evaluation harness runs `python3 run.py` exactly once.

