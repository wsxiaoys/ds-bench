import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Read the run ID from the environment variable
    run_id = os.environ.get('ZEALT_RUN_ID', 'default-run-id')
    sandbox_name = f"code-run-py-{run_id}"
    
    # Initialize the Daytona client
    daytona = Daytona()
    
    sandbox = None
    try:
        # Create the sandbox with the specified name
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = daytona.create(params)
        
        # Python snippet to compute the sum of integers from 1 to 100
        code = """
total = sum(range(1, 101))
print(total)
"""
        # Execute the snippet inside the sandbox
        response = sandbox.process.code_run(code)
        
        # Capture the result from the response
        result_value = response.result.strip()
        
        # Write to the local log file
        output_file = "/home/user/myproject/output.log"
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            f.write(f"Result: {result_value}\n")
            
    finally:
        # Delete the sandbox if it was created
        if sandbox:
            daytona.delete(sandbox)

if __name__ == "__main__":
    main()
