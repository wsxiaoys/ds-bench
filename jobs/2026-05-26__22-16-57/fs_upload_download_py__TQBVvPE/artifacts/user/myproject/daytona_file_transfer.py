#!/usr/bin/env python3
"""
Daytona File Upload and Download Demo

This script demonstrates transferring files in and out of a Daytona sandbox
using the Daytona Python SDK.
"""

import os
import sys
from pathlib import Path

# Import Daytona SDK
try:
    from daytona import Daytona
except ImportError:
    print("Error: Daytona SDK not installed. Install with: pip install daytona-sdk")
    sys.exit(1)


def main():
    # Configuration
    project_dir = Path("/home/user/myproject")
    input_file = project_dir / "input.txt"
    output_file = project_dir / "output.txt"
    log_file = project_dir / "output.log"
    
    # Read run-id from environment variable
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable not set")
        sys.exit(1)
    
    sandbox_name = f"fs-py-{run_id}"
    
    print(f"Starting Daytona file transfer demo")
    print(f"Run ID: {run_id}")
    print(f"Sandbox name: {sandbox_name}")
    
    sandbox = None
    
    try:
        # Step 1: Create local input file
        input_content = f"Hello Daytona {run_id}"
        input_file.write_text(input_content)
        print(f"Created input file: {input_file}")
        print(f"Content: {input_content}")
        
        # Step 2: Create Daytona sandbox
        print(f"Creating sandbox: {sandbox_name}")
        daytona = Daytona()
        sandbox = daytona.create(
            label=sandbox_name,
            # Use default image/template
        )
        print(f"Sandbox created successfully: {sandbox.id}")
        
        # Step 3: Upload file to sandbox
        remote_input_path = "/workspace/input.txt"
        print(f"Uploading file to sandbox at {remote_input_path}")
        sandbox.fs.upload_file(input_content, remote_input_path)
        print("File uploaded successfully")
        
        # Step 4: Run shell command to transform file (convert to uppercase)
        remote_output_path = "/workspace/output.txt"
        print(f"Transforming file to uppercase using 'tr' command")
        result = sandbox.process.exec(
            f"cat {remote_input_path} | tr '[:lower:]' '[:upper:]' > {remote_output_path}"
        )
        if result.exit_code != 0:
            raise Exception(f"Shell command failed with exit code {result.exit_code}: {result.stderr}")
        print("File transformed successfully")
        
        # Step 5: Download transformed file back to local filesystem
        print(f"Downloading transformed file from {remote_output_path}")
        output_content = sandbox.fs.download_file(remote_output_path)
        output_file.write_bytes(output_content)
        print(f"Downloaded file to: {output_file}")
        print(f"Output content: {output_content.decode('utf-8')}")
        
        # Step 6: Write confirmation to log file
        log_file.write_text("Upload+Download OK\n")
        print(f"Wrote confirmation to log file: {log_file}")
        
        print("\n=== SUCCESS ===")
        print(f"Input file created: {input_file}")
        print(f"Output file created: {output_file}")
        print(f"Log file created: {log_file}")
        print(f"Sandbox: {sandbox_name} (will be deleted)")
        
    except Exception as e:
        print(f"\nError during execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        # Step 7: Always delete the sandbox to prevent resource leaks
        if sandbox is not None:
            try:
                print(f"\nDeleting sandbox: {sandbox_name}")
                sandbox.delete()
                print("Sandbox deleted successfully")
            except Exception as e:
                print(f"Warning: Failed to delete sandbox: {e}")
                # Don't exit with error here, just log it


if __name__ == "__main__":
    main()