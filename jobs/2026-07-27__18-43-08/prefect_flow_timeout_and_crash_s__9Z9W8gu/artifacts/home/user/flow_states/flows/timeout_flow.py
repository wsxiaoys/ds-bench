"""Flow that deterministically ends in the **TimedOut** terminal state.

Prefect enforces a flow's `timeout_seconds` using a real cancellation scope
(an OS alarm signal on the main thread), so a flow that sleeps longer than
its configured timeout is aborted mid-run by the Prefect engine itself and
reported to the server with a Failed state whose *name* is "TimedOut".
"""

import time

from prefect import flow

from flows.common import TIMEOUT_FLOW_NAME

MAX_RUNTIME_SECONDS = 5
WORK_DURATION_SECONDS = 30  # deliberately longer than MAX_RUNTIME_SECONDS


@flow(
    name=TIMEOUT_FLOW_NAME,
    flow_run_name=TIMEOUT_FLOW_NAME,
    timeout_seconds=MAX_RUNTIME_SECONDS,
)
def timeout_flow() -> None:
    print(
        f"[{TIMEOUT_FLOW_NAME}] Starting work that takes "
        f"{WORK_DURATION_SECONDS}s, but the flow is capped at "
        f"{MAX_RUNTIME_SECONDS}s -> this run must end as TimedOut."
    )
    time.sleep(WORK_DURATION_SECONDS)
    print(f"[{TIMEOUT_FLOW_NAME}] This line should never be reached.")


if __name__ == "__main__":
    timeout_flow()
