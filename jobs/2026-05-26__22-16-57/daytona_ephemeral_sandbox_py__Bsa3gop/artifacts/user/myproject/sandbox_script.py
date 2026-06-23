#!/usr/bin/env python3
"""
Script to create and manage an ephemeral Daytona sandbox.
"""

import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Get environment variables
    api_key = os.environ.get("DAYTONA_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    
    if not api_key:
        raise ValueError("DAYTONA_API_KEY environment variable is not set")
    
    # Initialize Daytona client (reads from environment variables)
    daytona = Daytona()
    
    # Create sandbox name with run-id
    sandbox_name = f"ephem-py-{run_id}"
    
    print(f"Creating ephemeral sandbox: {sandbox_name}")
    
    # Create ephemeral sandbox with auto_stop_interval
    create_params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        ephemeral=True,
        auto_stop_interval=5
    )
    
    sandbox = daytona.create(create_params)
    print(f"Sandbox created with ID: {sandbox.id}")
    
    # Execute command to get the year
    print("Executing 'date +%Y' command in sandbox...")
    exec_result = sandbox.process.exec("date +%Y")
    year = exec_result.result.strip()
    print(f"Year from sandbox: {year}")
    
    # Re-read sandbox metadata to get auto_stop_interval
    print("Re-reading sandbox metadata...")
    sandbox_refreshed = daytona.get(sandbox.id)
    auto_stop = sandbox_refreshed.auto_stop_interval
    print(f"Auto-stop interval: {auto_stop} minutes")
    
    # Stop the sandbox (ephemeral flag will auto-delete it)
    print("Stopping sandbox...")
    sandbox.stop()
    print("Sandbox stopped (ephemeral deletion will occur automatically)")
    
    # Write results to output.log
    log_path = "/home/user/myproject/output.log"
    with open(log_path, "w") as f:
        f.write(f"Year: {year}\n")
        f.write(f"AutoStop: {auto_stop}\n")
    
    print(f"Results written to {log_path}")

if __name__ == "__main__":
    main()