import os
import time
from prefect import flow

# Point to the local Prefect server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

@flow(
    name="crash-flow-zr3x8sfksf",
    flow_run_name="crash-flow-run-zr3x8sfksf"
)
def crash_flow():
    print("Starting crash-flow-zr3x8sfksf...")
    for i in range(10):
        print(f"Working {i}...")
        time.sleep(1)

if __name__ == "__main__":
    crash_flow()
