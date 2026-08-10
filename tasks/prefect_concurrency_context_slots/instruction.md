# Slot-Based Critical-Section Concurrency Control with Prefect

## Background
You are hardening a data pipeline built on **Prefect 3.7.8** (already installed). A block of work touches a fragile shared resource that can only tolerate a bounded amount of simultaneous access. You must guard that block with a **named concurrency limit** that accounts for work in *weighted slots*: cheap tasks take one slot, expensive tasks take more. The whole system must run **fully locally and offline** — a locally-backed Prefect API only (no Prefect Cloud, no remote server, no external database, no network services). You must also emit tamper-evident, timestamped proof that the slot ceiling was honoured while the resource was genuinely under contention.

## Requirements
- Build a single Prefect flow, in the project, that submits **exactly 8 tasks** which run concurrently within one flow run and all finish successfully.
- Each task must guard the same critical section with a **named concurrency limit** whose name is `critical-section`. The limit's total capacity must be **4 slots**, and that limit must still exist and be active with capacity `4` after the run.
- Different tasks weigh differently. Inside the guarded section each task occupies exactly this many slots (the identifier `tN` is the task's own id, which the task must know and record):
  - `t0`: 1 slot
  - `t1`: 1 slot
  - `t2`: 2 slots
  - `t3`: 1 slot
  - `t4`: 2 slots
  - `t5`: 1 slot
  - `t6`: 2 slots
  - `t7`: 1 slot
- At no instant may the sum of slots held inside the critical section exceed 4. Because there are more tasks than capacity, the tasks must genuinely contend for entry, and over the run the momentary occupancy must actually reach the ceiling of 4.
- Each task must remain inside the guarded section for at least 1.0 second, so that contention windows overlap in real time.
- The flow run must complete in a `Completed` state.

## Implementation Hints
- Project path: /home/user/project
- Everything must work against a purely local Prefect API in ephemeral mode using the local `PREFECT_HOME`; do not start or depend on any remote/external service.
- Slot occupancy must be recorded from *inside* the guarded section: capture the enter timestamp only after the required slots are actually held, and capture the exit timestamp before the slots are released.
- After the run, the file `/home/user/project/occupancy_proof.json` must exist and contain a single JSON object with exactly these top-level keys:
  - `limit_name`: the string `critical-section`.
  - `total_slots`: the integer `4`.
  - `tasks`: a JSON array with exactly 8 objects, one per task, each with exactly the keys `task_id` (string, one of `t0`..`t7`, each appearing exactly once), `slots` (integer, the slot weight for that task as listed above), `entered_at` (string), and `exited_at` (string).
- Every `entered_at` and `exited_at` value must be a timezone-aware ISO-8601 UTC timestamp with microsecond precision that Python's `datetime.datetime.fromisoformat` can parse, and for each task `entered_at` must be strictly earlier than `exited_at`.
- Ensure the flow is actually executed so that both `/home/user/project/occupancy_proof.json` and the persisted `critical-section` concurrency limit exist afterwards.

