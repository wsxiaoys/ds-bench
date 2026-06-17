import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    api_key = os.environ.get("DAYTONA_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    
    if not api_key or not run_id:
        print("Missing environment variables")
        return

    daytona = Daytona()
    
    sandbox_name = f"ephem-py-{run_id}"
    
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        ephemeral=True,
        auto_stop_interval=5
    )
    
    print(f"Creating sandbox: {sandbox_name}")
    # The SDK create method might take params directly or as keyword arguments.
    # Based on instructions: CreateSandboxFromSnapshotParams is used.
    sandbox = daytona.create(params)
    
    try:
        # Execute command
        print("Executing date +%Y...")
        exec_result = sandbox.process.exec("date +%Y")
        year = exec_result.result.strip()
        
        # Re-fetch metadata
        print("Re-fetching sandbox metadata...")
        refetched_sandbox = daytona.get(sandbox.id)
        auto_stop = refetched_sandbox.auto_stop_interval
        
        # Write to log
        log_path = "/home/user/myproject/output.log"
        with open(log_path, "w") as f:
            f.write(f"Year: {year}\n")
            f.write(f"AutoStop: {auto_stop}\n")
            
        print(f"Wrote to {log_path}")
        
    finally:
        print("Stopping sandbox...")
        sandbox.stop()

if __name__ == "__main__":
    main()
