from prefect import flow
from prefect.flows import Flow
from prefect.states import State
from prefect.client.schemas.objects import FlowRun


def notify_success(flow: Flow, flow_run: FlowRun, state: State):
    with open("/home/user/project/success.log", "w") as f:
        f.write("Workflow succeeded")


def notify_failure(flow: Flow, flow_run: FlowRun, state: State):
    with open("/home/user/project/failure.log", "w") as f:
        f.write("Workflow failed")


@flow(on_completion=[notify_success], on_failure=[notify_failure])
def data_pipeline(should_fail: bool):
    if should_fail:
        raise ValueError("Simulated failure")
    return "Success"


if __name__ == "__main__":
    state1 = data_pipeline(should_fail=False, return_state=True)
    state2 = data_pipeline(should_fail=True, return_state=True)
    print(state1)
    print(state2)
