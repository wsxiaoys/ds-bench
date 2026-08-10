#!/usr/bin/env python3
"""Prefect 3.x dynamic fan-out flow with mixed child task-run states.

A single unit of work (``process_item``) is fanned out across the 20 integers
1..20.  Each input becomes its own concurrently-executed independent child task
run.  An input deterministically fails (raises) iff it is an exact multiple of
4; every other input succeeds.

The whole batch is carried to completion so that all 20 child task runs reach a
terminal state even though 5 of them fail.  Because part of the batch failed,
the flow run itself ends in the Failed state.

Every flow run and task run is recorded on the local self-hosted Prefect server
reachable at http://127.0.0.1:4200/api.
"""

import os

# Point the Prefect client at the local self-hosted server *before* prefect is
# imported so every flow/task run is recorded there.
os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4200/api")

from prefect import flow, task

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RUN_ID_PATH = "/logs/artifacts/run-id"


def _read_run_id() -> str:
    """Read the run-id artifact verbatim and strip surrounding whitespace."""
    with open(RUN_ID_PATH, "r") as fh:
        return fh.read().strip()


RUN_ID = _read_run_id()
FLOW_NAME = f"mapped-fanout-{RUN_ID}"

# The fixed collection of inputs: the 20 integers 1..20 inclusive.
INPUTS = list(range(1, 21))


# ---------------------------------------------------------------------------
# The single unit of work
# ---------------------------------------------------------------------------


@task
def process_item(n: int) -> int:
    """Process one input integer.

    Fails (raises ``ValueError``) iff *n* is an exact multiple of 4; succeeds
    (returns *n*) for every other input.  No randomness, timing, or environment
    influences which inputs fail.
    """
    if n % 4 == 0:
        raise ValueError(f"input {n} is a multiple of 4 and must fail")
    return n


# ---------------------------------------------------------------------------
# The flow
# ---------------------------------------------------------------------------


@flow(name=FLOW_NAME)
def mapped_fanout() -> None:
    """Dynamically fan ``process_item`` out across the integers 1..20.

    * Each of the 20 inputs becomes exactly one independent, concurrently
      executed child task run (via ``.submit()``).
    * The batch is carried to completion: we wait on every future with
      ``.wait()`` (which returns the terminal state without raising) so a
      failing input never aborts the batch.
    * After every child task run has reached a terminal state we raise so the
      flow run itself ends in the Failed state, reflecting that part of the
      batch failed while still surfacing every child task run.
    """
    # Fan out: submit the unit of work for every input up-front so all 20
    # child task runs start and run concurrently.
    futures = [process_item.submit(n) for n in INPUTS]

    # Carry the whole batch to completion.  ``wait()`` blocks until the child
    # task run finishes (it returns None; the terminal State is then available
    # via the ``state`` property).  A failing input never raises here, so it
    # does not short-circuit the remaining work.
    for future in futures:
        future.wait()
    states = [future.state for future in futures]

    completed_states = [s for s in states if s.is_completed()]
    failed_states = [s for s in states if s.is_failed()]

    print(f"child task runs -> completed: {len(completed_states)}  "
          f"failed: {len(failed_states)}  total: {len(states)}")

    # The flow run's own final state must be Failed because part of the batch
    # failed, even though every child task run was surfaced.
    if failed_states:
        raise RuntimeError(
            f"batch finished with {len(failed_states)} failed and "
            f"{len(completed_states)} completed child task runs"
        )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mapped_fanout()