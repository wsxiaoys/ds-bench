import os
from daytona_sdk import Daytona, CreateSandboxFromImageParams, Image

def main():
    run_id = os.environ.get("ZEALT_RUN_ID")
    api_key = os.environ.get("DAYTONA_API_KEY")
    
    if not run_id or not api_key:
        print("Missing ZEALT_RUN_ID or DAYTONA_API_KEY")
        return

    # Initialize Daytona client
    # The SDK usually picks up DAYTONA_API_KEY automatically if not provided
    client = Daytona()
    
    sandbox_name = f"decl-py-{run_id}"
    
    # Define declarative image
    image = Image.debian_slim('3.12').pip_install(['requests', 'pyyaml'])
    
    params = CreateSandboxFromImageParams(
        name=sandbox_name,
        image=image
    )
    
    print(f"Creating sandbox: {sandbox_name}")
    sandbox = client.create(params)
    
    try:
        # Run code inside sandbox
        code = """
import requests
import yaml
print(f"requests: {requests.__version__}")
print(f"yaml: {yaml.__version__}")
"""
        print("Running code inside sandbox...")
        response = sandbox.process.code_run(code)
        
        output = response.result
        print("Captured output:")
        print(output)
        
        # Write to log file
        log_path = "/home/user/myproject/output.log"
        with open(log_path, "w") as f:
            f.write(output)
            
    finally:
        print(f"Deleting sandbox: {sandbox_name}")
        client.delete(sandbox)

if __name__ == "__main__":
    main()
