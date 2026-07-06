import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Read run-id
    try:
        with open('/logs/artifacts/run-id', 'r') as f:
            run_id = f.read().strip()
    except Exception as e:
        print(f"Error reading run-id: {e}", file=sys.stderr)
        sys.exit(1)
    
    sandbox_name = f"ephem-py-{run_id}"
    print(f"Sandbox name: {sandbox_name}")
    
    # Initialize Daytona client
    daytona = Daytona()
    
    # Define creation parameters
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        ephemeral=True,
        auto_stop_interval=5,
        snapshot="daytona-small"
    )
    
    print("Creating ephemeral sandbox...")
    try:
        sandbox = daytona.create(params)
        print(f"Sandbox created with ID: {sandbox.id}")
    except Exception as e:
        print(f"Error creating sandbox: {e}", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Execute the date command
        print("Executing command inside sandbox...")
        res = sandbox.process.exec("date +%Y")
        year = res.result.strip()
        print(f"Captured Year: {year}")
        
        # Re-read the sandbox object from Daytona to get server-side metadata
        print("Re-fetching sandbox metadata...")
        fetched_sandbox = daytona.get(sandbox.id)
        auto_stop_interval = fetched_sandbox.auto_stop_interval
        print(f"Captured AutoStop Interval: {auto_stop_interval}")
        
        # Write to log file
        output_path = "/home/user/myproject/output.log"
        with open(output_path, "w") as log_file:
            log_file.write(f"Year: {year}\n")
            log_file.write(f"AutoStop: {auto_stop_interval}\n")
        print(f"Successfully wrote output to {output_path}")
        
    except Exception as e:
        print(f"Error during sandbox execution: {e}", file=sys.stderr)
    finally:
        # Stop the sandbox so that it auto-deletes
        print("Stopping sandbox...")
        try:
            sandbox.stop()
            print("Sandbox stopped.")
        except Exception as e:
            print(f"Error stopping sandbox: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
