import os
from prefect import flow

def on_success_hook(flow, flow_run, state):
    with open("/home/user/myproject/success.log", "w") as f:
        f.write("Success!")

def on_failure_hook(flow, flow_run, state):
    with open("/home/user/myproject/failure.log", "w") as f:
        f.write("Failed!")

@flow(on_completion=[on_success_hook])
def successful_flow():
    print("Executing successful_flow...")

@flow(on_failure=[on_failure_hook])
def failing_flow():
    print("Executing failing_flow...")
    raise ValueError("An intentional error occurred.")

if __name__ == "__main__":
    print("Running successful_flow...")
    successful_flow()
    
    print("Running failing_flow...")
    try:
        failing_flow()
    except ValueError as e:
        print(f"Caught expected ValueError from failing_flow: {e}")
