# Prefect Dynamic Fan-Out with Mixed Child Task-Run States

## Background
You are building a Prefect 3.x data-processing workflow that must dynamically fan a single unit of work out across a whole collection of inputs, run those units concurrently as independent child task runs, and remain observable in the Prefect UI even when part of the batch fails. Real pipelines routinely have a subset of records that cannot be processed; the workflow must still process every other record, record the outcome of every record individually, and report an honest aggregate result. A local, self-hosted Prefect server (UI and API) is the only backend — no Prefect Cloud, no external services.

## Requirements
- Stand up and use a locally self-hosted Prefect server; every flow run and task run you produce must be recorded there and visible in its UI.
- Author a single Prefect flow that dynamically distributes one unit of work across a fixed collection of inputs, where each input becomes its own concurrently-executed child task run.
- A deterministic subset of the inputs must fail (raise), while all remaining inputs succeed.
- Every input's child task run must be recorded with a terminal state — the batch must run to completion rather than aborting when the first input fails.
- The flow run must end in the correct aggregate terminal state given that part of the batch failed.
- Execute the flow so that the resulting flow run actually exists and is visible in the local UI.

## Implementation Hints
- Project path: /home/user/mapped_fanout
- Read the `run-id` from `/logs/artifacts/run-id` and use it verbatim where required below.
- A local Prefect server must be running and reachable at API base URL `http://127.0.0.1:4200/api`, with its UI served at `http://127.0.0.1:4200`. Every flow run and task run you create MUST be recorded on this local server (not any cloud backend).
- The flow's registered flow name MUST be exactly `mapped-fanout-<run-id>` (for example, if the file `/logs/artifacts/run-id` contains `zrabc123`, the flow name must be `mapped-fanout-zrabc123`).
- The input collection is the 20 integers from 1 to 20 inclusive. The flow MUST fan its single unit of work out across all 20 of these inputs, and each input MUST become exactly one independent child task run that runs concurrently with the others. The completed flow run MUST contain exactly 20 child task runs total and no other task runs.
- Failure rule (deterministic): the child task run handling an input MUST fail (raise an exception) if and only if that integer is an exact multiple of 4; for every other input the child task run MUST succeed. No randomness, timing, or environment may influence which inputs fail.
- Given that rule, exactly 15 child task runs MUST end in the Completed state and exactly 5 child task runs MUST end in the Failed state.
- The whole batch MUST be carried to completion so that all 20 child task runs are recorded with terminal states even though 5 of them fail; the flow MUST NOT abort at the first failing input.
- The flow run's own final state MUST be Failed, reflecting that part of the batch failed while still surfacing every child task run.
- The flow MUST be defined in the file `/home/user/mapped_fanout/flow.py`, and running `python3 flow.py` from `/home/user/mapped_fanout` (with the client pointed at the local server) MUST execute the flow and record the flow run and its 20 child task runs on the local server. Running it non-interactively must not require additional arguments.
- After building the flow, run it at least once so that the flow run for `mapped-fanout-<run-id>` and its 20 child task runs are present and visible in the local UI.
