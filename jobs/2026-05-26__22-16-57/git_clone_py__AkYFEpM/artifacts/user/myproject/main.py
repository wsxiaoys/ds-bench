#!/usr/bin/env python3
"""
Clone a Git Repository in a Daytona Sandbox with the Python SDK

This script creates a Daytona sandbox, clones a GitHub repository,
inspects the Git state, and cleans up the sandbox.
"""

import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

# Configuration
REPO_URL = "https://github.com/octocat/Hello-World"
CLONE_PATH = "/home/daytona/hello-world"
README_PATH = "/home/daytona/hello-world/README"
OUTPUT_LOG = "/home/user/myproject/output.log"


def main():
    """Main function to execute the Daytona sandbox operations."""
    sandbox = None
    
    try:
        # Read run-id from environment variable
        run_id = os.environ.get("ZEALT_RUN_ID")
        if not run_id:
            print("Error: ZEALT_RUN_ID environment variable not set")
            sys.exit(1)
        
        print(f"Run ID: {run_id}")
        
        # Create sandbox name
        sandbox_name = f"git-py-{run_id}"
        print(f"Sandbox name: {sandbox_name}")
        
        # Initialize Daytona client (uses DAYTONA_API_KEY from environment)
        print("Initializing Daytona client...")
        daytona = Daytona()
        
        # Create sandbox
        print(f"Creating sandbox '{sandbox_name}'...")
        params = CreateSandboxFromSnapshotParams(
            name=sandbox_name,
            language="python"
        )
        sandbox = daytona.create(params, timeout=120)
        print(f"Sandbox created: {sandbox.id}")
        
        # Clone the repository
        print(f"Cloning repository from {REPO_URL} into {CLONE_PATH}...")
        sandbox.git.clone(
            url=REPO_URL,
            path=CLONE_PATH
        )
        print("Repository cloned successfully")
        
        # Get git status
        print("Getting git status...")
        status = sandbox.git.status(CLONE_PATH)
        branch_name = status.current_branch
        print(f"Current branch: {branch_name}")
        
        # Write branch name to log file
        print(f"Writing branch info to {OUTPUT_LOG}...")
        with open(OUTPUT_LOG, "w") as f:
            f.write(f"Branch: {branch_name}\n")
        
        # Read README file
        print(f"Reading README from {README_PATH}...")
        readme_content = sandbox.fs.download_file(README_PATH)
        
        # Decode bytes to string and get first line
        readme_text = readme_content.decode('utf-8')
        first_line = readme_text.split('\n')[0].strip()
        print(f"First line of README: {first_line}")
        
        # Append first line to log file
        print(f"Appending README info to {OUTPUT_LOG}...")
        with open(OUTPUT_LOG, "a") as f:
            f.write(f"README: {first_line}\n")
        
        print(f"Log file created successfully at {OUTPUT_LOG}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        # Clean up: delete the sandbox
        if sandbox:
            print(f"Deleting sandbox '{sandbox_name}'...")
            try:
                sandbox.delete()
                print("Sandbox deleted successfully")
            except Exception as e:
                print(f"Error deleting sandbox: {e}")


if __name__ == "__main__":
    main()