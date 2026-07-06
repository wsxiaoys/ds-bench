"""Prefect flow demonstrating state change hooks for success and failure."""

from prefect import flow


SUCCESS_LOG = "/home/user/project/success.log"
FAILURE_LOG = "/home/user/project/failure.log"


def notify_success(flow, flow_run, state):
    """State change hook: write a success notification."""
    with open(SUCCESS_LOG, "a", encoding="utf-8") as f:
        f.write("Workflow succeeded")


def notify_failure(flow, flow_run, state):
    """State change hook: write a failure notification."""
    with open(FAILURE_LOG, "a", encoding="utf-8") as f:
        f.write("Workflow failed")


@flow(
    name="data_pipeline",
    on_completion=[notify_success],
    on_failure=[notify_failure],
)
def data_pipeline(should_fail: bool = False):
    """A simple data pipeline that may be configured to fail."""
    if should_fail:
        raise ValueError("Simulated failure")
    return "Success"


if __name__ == "__main__":
    # First run: succeed
    first_state = data_pipeline(should_fail=False, return_state=True)
    print(f"First run state: {first_state.type.name}")

    # Second run: fail (return_state=True keeps the script alive to run both)
    second_state = data_pipeline(should_fail=True, return_state=True)
    print(f"Second run state: {second_state.type.name}")