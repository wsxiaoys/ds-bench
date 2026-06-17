import multiprocessing
import subprocess
import time
import os
from pathlib import Path

PROJECT_DIR = Path("/home/user/prefect-project")
COUNTER_FILE = PROJECT_DIR / "counter.txt"
FLOW_SCRIPT = PROJECT_DIR / "flow.py"

def run_flow(index):
    # Use a separate PREFECT_HOME for each process to avoid SQLite database contention
    # during automatic migrations of the temporary local server.
    env = os.environ.copy()
    env["PREFECT_HOME"] = str(PROJECT_DIR / f".prefect_{index}")
    
    result = subprocess.run(["python3", str(FLOW_SCRIPT)], capture_output=True, text=True, env=env)
    print(f"--- Process {index} Output ---\n{result.stdout}")
    if result.stderr:
        # Filter out the common info messages about temporary server to keep output clean
        filtered_stderr = "\n".join([line for line in result.stderr.splitlines() 
                                    if "INFO" not in line and "Starting temporary server" not in line])
        if filtered_stderr:
            print(f"--- Process {index} Errors ---\n{filtered_stderr}")

if __name__ == "__main__":
    # Ensure initial value is 0
    COUNTER_FILE.write_text("0")
    print(f"Initial counter value: {COUNTER_FILE.read_text().strip()}")

    processes = []
    start_time = time.time()
    
    # Launch 5 concurrent flow runs
    for i in range(5):
        p = multiprocessing.Process(target=run_flow, args=(i,))
        p.start()
        processes.append(p)
        print(f"Started process {i} (PID: {p.pid})")

    # Wait for all processes to complete
    for p in processes:
        p.join()
        
    end_time = time.time()
    
    final_val = COUNTER_FILE.read_text().strip()
    print("\n" + "="*30)
    print(f"Final counter value: {final_val}")
    print(f"Total time: {end_time - start_time:.2f} seconds")
    
    if final_val == "5":
        print("Success: Counter incremented correctly to 5.")
    else:
        print(f"Failure: Counter value is {final_val}, expected 5.")
    print("="*30)
