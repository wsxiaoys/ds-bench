from prefect import flow


def notify_success(flow, flow_run, state):
    """State change hook triggered on successful flow completion."""
    with open("/home/user/project/success.log", "w") as f:
        f.write("Workflow succeeded")


def notify_failure(flow, flow_run, state):
    """State change hook triggered on flow failure."""
    with open("/home/user/project/failure.log", "w") as f:
        f.write("Workflow failed")


@flow(name="data_pipeline", on_completion=[notify_success], on_failure=[notify_failure])
def data_pipeline(should_fail: bool):
    if should_fail:
        raise ValueError("Simulated failure")
    return "Success"


if __name__ == "__main__":
    # First run: should succeed
    success_state = data_pipeline(should_fail=False, return_state=True)
    print(f"First run state: {success_state}")

    # Second run: should fail
    failure_state = data_pipeline(should_fail=True, return_state=True)
    print(f"Second run state: {failure_state}")