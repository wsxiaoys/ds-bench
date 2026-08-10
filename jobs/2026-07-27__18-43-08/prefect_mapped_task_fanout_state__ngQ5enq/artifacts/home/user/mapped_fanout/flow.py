"""
Prefect 3.x dynamic fan-out flow.

Reads the run-id from /logs/artifacts/run-id and registers a flow named
`mapped-fanout-<run-id>`. The flow fans a single unit-of-work task out
across the 20 integers 1..20 as independent, concurrently-executed child
task runs (via .submit()). Multiples of 4 (4, 8, 12, 16, 20 -> 5 inputs)
deterministically raise, and the rest (15 inputs) succeed. The batch runs
to completion (all child task runs reach a terminal state) and the flow
itself ends in the Failed state because part of the batch failed.
"""

import os

from prefect import flow, task

RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id() -> str:
    with open(RUN_ID_PATH, "r") as f:
        return f.read().strip()


RUN_ID = _read_run_id()
FLOW_NAME = f"mapped-fanout-{RUN_ID}"


@task
def process_input(n: int) -> int:
    """Single unit of work applied to one input.

    Deterministically fails iff `n` is an exact multiple of 4.
    """
    if n % 4 == 0:
        raise ValueError(f"Processing failed for input {n}: multiple of 4")
    return n * n


@flow(name=FLOW_NAME)
def mapped_fanout_flow():
    inputs = list(range(1, 21))  # 1..20 inclusive

    # Fan out: submit one concurrent child task run per input.
    futures = [process_input.submit(n) for n in inputs]

    # Wait for every child task run to reach a terminal state, collecting
    # results/exceptions individually so the whole batch runs to completion
    # even though some inputs fail.
    results = []
    failures = []
    for n, future in zip(inputs, futures):
        future.wait()
        state = future.state
        if state.is_completed():
            results.append((n, future.result()))
        else:
            try:
                future.result()
            except Exception as exc:  # noqa: BLE001
                failures.append((n, exc))

    print(f"Succeeded: {len(results)} inputs -> {sorted(r[0] for r in results)}")
    print(f"Failed: {len(failures)} inputs -> {sorted(f[0] for f in failures)}")

    # Aggregate result: if any child failed, the flow run must end Failed.
    if failures:
        raise RuntimeError(
            f"{len(failures)} of {len(inputs)} inputs failed: "
            f"{sorted(n for n, _ in failures)}"
        )

    return results


if __name__ == "__main__":
    os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4200/api")
    mapped_fanout_flow()
