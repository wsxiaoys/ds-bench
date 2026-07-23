# Throttle Concurrent Work with a Prefect Global Concurrency Limit

## Background
You are building a batch pipeline with **Prefect 3.4.20** (already installed, running fully offline against Prefect's local/ephemeral API backed by local SQLite). The pipeline fans out a batch of independent work units that all become runnable at the same time, but a shared downstream resource can only tolerate a bounded number of them running at once. You must enforce that ceiling using a Prefect **global concurrency limit** and produce tamper-evident, timestamped proof that the ceiling was respected while every unit still completed.

## Requirements
- Implement a re-runnable pipeline that submits a fixed batch of independent work units so that they contend to run simultaneously.
- Throttle the units with a **named global concurrency limit** so that no more than the limit's current value ever hold the shared resource at the same time.
- Every work unit must still complete on every run.
- Emit a timestamped occupancy log that makes the concurrency ceiling and the completion of all work independently verifiable.

## Implementation Hints
- Prefect version: 3.4.20 (do not change it). Everything runs locally/offline; do not rely on Prefect Cloud or any remote/network service.
- Project path: /home/user/project
- Command (re-runnable, run from the project path): `python3 pipeline.py`
- Global concurrency limit name: `render-pool`. Establish it once, before running the pipeline, with an **initial limit of 3**, e.g. `prefect gcl create render-pool --limit 3`.
- The batch must contain **exactly 12** work units, identified by the integer ids `0` through `11`. All 12 must be submitted so that they contend concurrently (do not run them one-at-a-time).
- Each work unit must acquire **exactly one** slot on the `render-pool` limit for the entire duration of its work, and its simulated work must hold that slot for **at least 1.0 second** so contention is observable.
- The number of work units simultaneously holding their slot must **never exceed the current server-side value of the `render-pool` limit**, and under this contention it must actually **reach** that value.
- The enforced ceiling must track the `render-pool` limit's **current server-side value dynamically**: if that value is changed on the server between runs, the maximum simultaneous count on the next run must equal the new value **without editing `pipeline.py`**. Do not hard-code the ceiling.
- The pipeline must be a **pure consumer** of the limit: `pipeline.py` MUST NOT create, update, delete, or otherwise mutate the `render-pool` limit.
- If the `render-pool` limit does **not exist** when `pipeline.py` runs, the pipeline must fail with a **non-zero exit status** and must not run the batch unthrottled.
- Occupancy log: `/home/user/project/occupancy.jsonl`. Each run must **overwrite** this file so it reflects only that run.
  - The file is JSON Lines: one JSON object per line, one object per event.
  - For every work unit, write exactly one `acquire` event immediately after its slot is acquired (before the work begins) and exactly one `release` event immediately after its work finishes (as its slot is released).
  - Each object must have exactly these keys: `event` (string, either `"acquire"` or `"release"`), `unit` (integer 0-11), `ts` (number: POSIX timestamp in seconds, as a float, taken at the moment of the event).
  - Concurrent writes must not corrupt or interleave lines; every line must be independently parseable JSON.

## Notes
- No external integrations, credentials, or network access are required or permitted; the task is fully self-contained on the local machine.

