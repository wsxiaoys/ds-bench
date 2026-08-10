"""Dynamic fan-out flow that processes 20 inputs concurrently, with deterministic
failures for multiples of 4.  All 20 child task runs complete (some Failed, some
Completed) and the parent flow run ends in a Failed state."""

from __future__ import annotations

from prefect import flow, task


@task
def process_input(value: int) -> str:
    """Process a single input value.

    Fails if *value* is an exact multiple of 4; succeeds otherwise.
    """
    if value % 4 == 0:
        raise ValueError(f"Input {value} is a multiple of 4 – failing deterministically.")
    return f"Processed {value} successfully."


@flow(name="mapped-fanout-zrxu2zqjxx")
def mapped_fanout_flow() -> None:
    """Fan out one unit of work across the integers 1..20.

    Each integer becomes an independent child task run.  Multiples of 4 are
    designed to fail; all others succeed.  The flow itself will end in a Failed
    state because at least one child task run failed, but every child task run
    will be recorded with a terminal state.
    """
    inputs = list(range(1, 21))  # 1..20 inclusive

    # .map() creates one independent child task run per input.
    # All children run concurrently; Prefect records each one individually.
    # When any child fails, the flow run will ultimately fail, but Prefect 3.x
    # does NOT cancel sibling mapped tasks — they all run to completion.
    futures = process_input.map(inputs)

    # Wait for all children to finish.  When a child failed, .result() will
    # raise.  We catch each individually so we can observe all outcomes, then
    # re-raise at the end so the flow run is marked Failed.
    failures: list[Exception] = []
    success_count = 0
    for future in futures:
        try:
            future.result()
            success_count += 1
        except Exception as exc:
            failures.append(exc)

    failure_count = len(failures)
    print(f"Batch complete: {success_count} succeeded, {failure_count} failed.")

    if failures:
        raise RuntimeError(
            f"{failure_count} child task run(s) failed while {success_count} succeeded."
        )


if __name__ == "__main__":
    mapped_fanout_flow()
