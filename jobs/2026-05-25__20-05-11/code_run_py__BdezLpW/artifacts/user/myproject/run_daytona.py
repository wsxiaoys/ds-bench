import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    api_key = os.environ.get("DAYTONA_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    
    if not api_key or not run_id:
        print("Error: DAYTONA_API_KEY or ZEALT_RUN_ID not set.")
        sys.exit(1)
        
    sandbox_name = f"code-run-py-{run_id}"
    project_path = "/home/user/myproject"
    log_file = os.path.join(project_path, "output.log")
    
    daytona = Daytona()
    sandbox = None
    
    try:
        # Create the sandbox
        print(f"Creating sandbox: {sandbox_name}")
        sandbox = daytona.create(CreateSandboxFromSnapshotParams(name=sandbox_name))
        
        # Run the computation
        # Sum of integers from 1 through 100 inclusive
        code = "print(sum(range(1, 101)))"
        print("Running code in sandbox...")
        response = sandbox.process.code_run(code)
        
        # Capture result from stdout
        result = response.result.strip()
        print(f"Captured result: {result}")
        
        # Write to log file in format "Result: <value>"
        os.makedirs(project_path, exist_ok=True)
        with open(log_file, "w") as f:
            f.write(f"Result: {result}\n")
            
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
    finally:
        if sandbox:
            print(f"Deleting sandbox: {sandbox_name}")
            try:
                daytona.delete(sandbox)
            except Exception as delete_error:
                print(f"Failed to delete sandbox: {delete_error}")

if __name__ == "__main__":
    main()
