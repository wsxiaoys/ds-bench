import os
import subprocess
import time
import signal
import sys

# Point to the local Prefect server
os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

# Get absolute path of current directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def run_timeout_flow():
    print("\n" + "="*40)
    print("Executing: timeout-flow-zr3x8sfksf")
    print("="*40)
    script_path = os.path.join(BASE_DIR, "timeout_flow.py")
    p = subprocess.Popen(["python3", script_path])
    p.wait()
    print(f"timeout-flow-zr3x8sfksf finished with exit code {p.returncode}")

def run_crash_flow():
    print("\n" + "="*40)
    print("Executing: crash-flow-zr3x8sfksf")
    print("="*40)
    script_path = os.path.join(BASE_DIR, "crash_flow.py")
    p = subprocess.Popen(["python3", script_path])
    
    # Wait for the flow run to start and register with the Prefect server
    # We sleep 3 seconds to ensure it is in RUNNING state
    time.sleep(3)
    
    print("Sending SIGINT to simulate a true infrastructure crash...")
    p.send_signal(signal.SIGINT)
    p.wait()
    print(f"crash-flow-zr3x8sfksf finished with exit code {p.returncode}")

def run_failure_flow():
    print("\n" + "="*40)
    print("Executing: failure-flow-zr3x8sfksf")
    print("="*40)
    script_path = os.path.join(BASE_DIR, "failure_flow.py")
    p = subprocess.Popen(["python3", script_path])
    p.wait()
    print(f"failure-flow-zr3x8sfksf finished with exit code {p.returncode}")

if __name__ == "__main__":
    print("Starting execution of all three Prefect flows...")
    
    run_timeout_flow()
    run_crash_flow()
    run_failure_flow()
    
    print("\n" + "="*40)
    print("All three flows executed. Check your local Prefect UI at http://127.0.0.1:4200")
    print("="*40)
