from prefect import flow


def on_success_hook(flow, flow_run, state):
    with open('/home/user/myproject/success.log', 'w') as f:
        f.write('Success!')


def on_failure_hook(flow, flow_run, state):
    with open('/home/user/myproject/failure.log', 'w') as f:
        f.write('Failed!')


@flow(on_completion=[on_success_hook])
def successful_flow():
    return "All good"


@flow(on_failure=[on_failure_hook])
def failing_flow():
    raise ValueError("This flow is supposed to fail")


if __name__ == '__main__':
    successful_flow()
    try:
        failing_flow()
    except ValueError:
        pass
