import subprocess
import os
import pathlib
import time

DATA_FILE = pathlib.Path("/home/user/prefect-project/counter.txt")

def run_concurrent_flows():
    # Reset the counter to 0 before running
    DATA_FILE.write_text("0\n")
    print("Reset counter to 0")
    
    # Start the Prefect server in the background
    print("Starting Prefect server in the background...")
    subprocess.run(["prefect", "server", "start", "--background"], check=True)
    
    # Wait a moment for the server to spin up and be healthy
    time.sleep(3)
    
    # Set the environment variable to connect to the background Prefect server
    env = os.environ.copy()
    env["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"
    
    # Start 5 concurrent processes
    processes = []
    print("Launching 5 concurrent flow runs...")
    for i in range(5):
        p = subprocess.Popen(
            ["python3", "/home/user/prefect-project/flow.py"],
            env=env
        )
        processes.append(p)
        
    # Wait for all processes to finish
    for p in processes:
        p.wait()
        
    # Stop the Prefect server to clean up
    print("Stopping Prefect server...")
    subprocess.run(["prefect", "server", "stop"], check=True)
    
    # Read the final value
    final_val = int(DATA_FILE.read_text().strip())
    print(f"All concurrent runs finished. Final counter value: {final_val}")
    assert final_val == 5, f"Expected final value to be 5, but got {final_val}"
    print("Locking mechanism works perfectly! No updates were lost.")

if __name__ == "__main__":
    run_concurrent_flows()
