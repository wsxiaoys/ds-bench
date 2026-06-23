#!/usr/bin/env python3
"""
Daytona Sandbox with Custom Environment Variables

This script creates a Daytona sandbox with custom environment variables,
verifies their values inside the sandbox, logs them, and cleans up.
"""

import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Read the run-id from environment variable
    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    
    # Create sandbox name and MY_VAR value using run-id
    sandbox_name = f"envvar-py-{run_id}"
    my_var_value = f"hello-{run_id}"
    
    # Initialize Daytona client (authentication via DAYTONA_API_KEY env var)
    client = Daytona()
    
    sandbox = None
    try:
        # Create sandbox with custom name and environment variables
        print(f"Creating sandbox: {sandbox_name}")
        params = CreateSandboxFromSnapshotParams(
            name=sandbox_name,
            env_vars={
                "MY_VAR": my_var_value,
                "APP_MODE": "production"
            }
        )
        sandbox = client.create(params)
        print(f"Sandbox created successfully: {sandbox.id}")
        
        # Execute commands inside the sandbox to read environment variables
        print("Reading MY_VAR from sandbox...")
        my_var_result = sandbox.process.exec("echo $MY_VAR")
        my_var_output = my_var_result.result.strip()
        
        print("Reading APP_MODE from sandbox...")
        app_mode_result = sandbox.process.exec("echo $APP_MODE")
        app_mode_output = app_mode_result.result.strip()
        
        # Write captured values to log file
        log_path = "/home/user/myproject/output.log"
        print(f"Writing results to {log_path}")
        with open(log_path, "w") as f:
            f.write(f"MY_VAR: {my_var_output}\n")
            f.write(f"APP_MODE: {app_mode_output}\n")
        
        print("Successfully completed!")
        print(f"Log file contents:")
        with open(log_path, "r") as f:
            print(f.read())
            
    except Exception as e:
        print(f"Error occurred: {e}")
        raise
    finally:
        # Clean up: delete the sandbox even if an error occurred
        if sandbox is not None:
            print(f"Deleting sandbox: {sandbox.id}")
            sandbox.delete()
            print("Sandbox deleted successfully")

if __name__ == "__main__":
    main()