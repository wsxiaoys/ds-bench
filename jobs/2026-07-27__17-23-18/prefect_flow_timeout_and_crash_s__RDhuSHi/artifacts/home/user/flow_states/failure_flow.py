import os
from prefect import flow

# Point to the local Prefect server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

@flow(
    name="failure-flow-zr3x8sfksf",
    flow_run_name="failure-flow-run-zr3x8sfksf"
)
def failure_flow():
    print("Starting failure-flow-zr3x8sfksf...")
    raise ValueError("Ordinary exception raised in workflow code")

if __name__ == "__main__":
    try:
        failure_flow()
    except Exception as e:
        print(f"Caught expected failure exception: {e}")
