import os
import sys
from daytona import Daytona, CreateSandboxFromImageParams, Image

def main():
    # 1. Read run-id
    try:
        with open("/logs/artifacts/run-id", "r") as f:
            run_id = f.read().strip()
    except Exception as e:
        print(f"Error reading run-id: {e}", file=sys.stderr)
        sys.exit(1)
    
    sandbox_name = f"decl-py-{run_id}"
    print(f"Using run-id: {run_id}")
    print(f"Sandbox name will be: {sandbox_name}")

    # 2. Build declarative Image & Create Sandbox
    daytona = Daytona()
    image = (
        Image.debian_slim("3.12")
        .pip_install(["requests", "pyyaml"])
    )
    
    params = CreateSandboxFromImageParams(
        name=sandbox_name,
        image=image
    )
    
    sandbox = None
    try:
        print("Creating sandbox on Daytona...")
        sandbox = daytona.create(params)
        print(f"Sandbox created. ID: {sandbox.id}")
        
        # 3. Run Python code inside sandbox
        code_snippet = """
import requests
import yaml
print(f"requests: {requests.__version__}")
print(f"yaml: {yaml.__version__}")
"""
        print("Executing Python snippet inside sandbox...")
        response = sandbox.process.code_run(code_snippet)
        
        stdout_output = response.result
        print("Execution stdout:")
        print(stdout_output)
        
        # 4. Write to output.log on host
        output_log_path = "/home/user/myproject/output.log"
        print(f"Writing output to {output_log_path}...")
        with open(output_log_path, "w") as f:
            f.write(stdout_output)
            
    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    finally:
        if sandbox is not None:
            print(f"Cleaning up: deleting sandbox {sandbox_name}...")
            try:
                daytona.delete(sandbox)
                print("Sandbox deleted successfully.")
            except Exception as e:
                print(f"Failed to delete sandbox: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
