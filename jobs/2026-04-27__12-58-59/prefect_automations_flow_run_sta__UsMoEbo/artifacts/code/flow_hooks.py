from prefect import flow
import os

def on_success_hook(flow, flow_run, state):
    with open("/home/user/myproject/success.log", "w") as f:
        f.write("Success!")

def on_failure_hook(flow, flow_run, state):
    with open("/home/user/myproject/failure.log", "w") as f:
        f.write("Failed!")

@flow(on_completion=[on_success_hook])
def successful_flow():
    print("Executing successful flow...")
    return "Done"

@flow(on_failure=[on_failure_hook])
def failing_flow():
    print("Executing failing flow...")
    raise ValueError("Intentional failure")

if __name__ == "__main__":
    print("Starting successful_flow...")
    successful_flow()
    
    print("\nStarting failing_flow...")
    try:
        failing_flow()
    except ValueError as e:
        print(f"Caught expected error: {e}")
