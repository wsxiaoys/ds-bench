import os
import time
from prefect import flow

# Point to the local Prefect server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

@flow(
    name="timeout-flow-zr3x8sfksf",
    timeout_seconds=5,
    flow_run_name="timeout-flow-run-zr3x8sfksf"
)
def timeout_flow():
    print("Starting timeout-flow-zr3x8sfksf...")
    for i in range(10):
        print(f"Working {i}...")
        time.sleep(1)
    print("Finished timeout-flow-zr3x8sfksf (should not reach here)")

if __name__ == "__main__":
    try:
        timeout_flow()
    except Exception as e:
        print(f"Caught expected timeout exception: {e}")
