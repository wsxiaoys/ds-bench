"""Prefect flow run state automations using state change hooks.

This script demonstrates how to attach state change hooks to Prefect flows
to perform side effects (e.g., logging) when a flow run changes state.
"""

from prefect import flow
from prefect.runtime import flow_run as flow_run_ctx


SUCCESS_LOG_PATH = "/home/user/myproject/success.log"
FAILURE_LOG_PATH = "/home/user/myproject/failure.log"


def on_success_hook(flow, flow_run, state):
    """Write 'Success!' to the success log when the flow completes successfully."""
    with open(SUCCESS_LOG_PATH, "w") as f:
        f.write("Success!")


def on_failure_hook(flow, flow_run, state):
    """Write 'Failed!' to the failure log when the flow fails."""
    with open(FAILURE_LOG_PATH, "w") as f:
        f.write("Failed!")


@flow(
    name="successful_flow",
    on_completion=[on_success_hook],
)
def successful_flow():
    """A flow that runs without errors and triggers the success hook."""
    print("successful_flow is running...")
    return "All good"


@flow(
    name="failing_flow",
    on_failure=[on_failure_hook],
)
def failing_flow():
    """A flow that raises a ValueError and triggers the failure hook."""
    print("failing_flow is running...")
    raise ValueError("This flow is meant to fail.")


if __name__ == "__main__":
    print("Running successful_flow...")
    successful_flow()

    print("Running failing_flow...")
    try:
        failing_flow()
    except ValueError as exc:
        print(f"Caught expected exception: {exc}")
