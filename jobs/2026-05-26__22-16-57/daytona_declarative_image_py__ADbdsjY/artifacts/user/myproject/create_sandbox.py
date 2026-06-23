#!/usr/bin/env python3
import os
import sys

# Import Daytona SDK
from daytona import Image, CreateSandboxFromImageParams, Daytona

def main():
    # Read the run-id from environment variable
    run_id = os.environ.get('ZEALT_RUN_ID')
    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable not set")
        sys.exit(1)
    
    print(f"Run ID: {run_id}")
    
    sandbox_name = f"decl-py-{run_id}"
    print(f"Creating sandbox: {sandbox_name}")
    
    try:
        # Build declarative image based on debian_slim('3.12') with requests and pyyaml
        image = Image.debian_slim('3.12').pip_install(['requests', 'pyyaml'])
        
        # Create a Daytona client instance
        daytona = Daytona()
        
        # Create sandbox from the declarative image
        sandbox = daytona.create(CreateSandboxFromImageParams(
            name=sandbox_name,
            image=image
        ))
        
        print(f"Successfully created sandbox: {sandbox.name}")
        
        # Run Python code inside the sandbox to check package versions
        python_code = """
import requests
import yaml

print(f"requests: {requests.__version__}")
print(f"yaml: {yaml.__version__}")
"""
        
        result = sandbox.process.code_run(python_code)
        print(f"Code execution result: {result.result}")
        
        # Parse the output to extract versions
        output_lines = result.result.strip().split('\n')
        requests_version = None
        yaml_version = None
        
        for line in output_lines:
            if line.startswith('requests:'):
                requests_version = line.split(' ', 1)[1]
            elif line.startswith('yaml:'):
                yaml_version = line.split(' ', 1)[1]
        
        # Write versions to log file
        log_file_path = '/home/user/myproject/output.log'
        with open(log_file_path, 'w') as f:
            if requests_version:
                f.write(f"requests: {requests_version}\n")
            if yaml_version:
                f.write(f"yaml: {yaml_version}\n")
        
        print(f"Successfully wrote versions to {log_file_path}")
        
    except Exception as e:
        print(f"Error during sandbox creation or execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        # Always delete the sandbox
        try:
            if 'sandbox' in locals():
                print(f"Deleting sandbox: {sandbox_name}")
                sandbox.delete()
                print(f"Successfully deleted sandbox: {sandbox_name}")
        except Exception as e:
            print(f"Error deleting sandbox: {e}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    main()