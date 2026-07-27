"""Flow that deterministically ends in the **Failed** terminal state.

This is an ordinary Python exception raised from user workflow code. Prefect
catches it and reports the flow run to the server with a Failed state
(state name "Failed") -- this is what distinguishes it from the Crashed
flow, whose failure comes from an infrastructure-level interruption instead
of workflow code raising an exception.
"""

from prefect import flow

from flows.common import FAILURE_FLOW_NAME


@flow(name=FAILURE_FLOW_NAME, flow_run_name=FAILURE_FLOW_NAME)
def failure_flow() -> None:
    print(f"[{FAILURE_FLOW_NAME}] Running, then deliberately raising an exception...")
    raise RuntimeError(
        "Deliberate failure: this flow always raises an ordinary exception "
        "so its run ends in the Failed state."
    )


if __name__ == "__main__":
    failure_flow()
