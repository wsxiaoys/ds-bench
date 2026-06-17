#!/usr/bin/env python3
"""
Run Python code in a Daytona sandbox and capture the result.
"""

import os
import daytona

# Read environment variables
run_id = os.environ.get('ZEALT_RUN_ID')
api_key = os.environ.get('DAYTONA_API_KEY')

if not run_id:
    raise ValueError("ZEALT_RUN_ID environment variable is not set")

if not api_key:
    raise ValueError("DAYTONA_API_KEY environment variable is not set")

# Create sandbox name
sandbox_name = f"code-run-py-{run_id}"

# Initialize Daytona client
client = daytona.Client(api_key=api_key)

sandbox = None

try:
    # Create the sandbox
    print(f"Creating sandbox: {sandbox_name}")
    sandbox = client.create_sandbox(name=sandbox_name)

    # Define the Python code to run
    code = """
result = sum(range(1, 101))
print(result)
"""

    # Run the code in the sandbox
    print("Running code in sandbox...")
    response = sandbox.process.code_run(code)

    # Capture the result (stdout from the code run)
    output = response.result.strip()

    # Convert to integer
    result_value = int(output)

    # Write the result to output.log
    output_path = "/home/user/myproject/output.log"
    with open(output_path, 'w') as f:
        f.write(f"Result: {result_value}\n")

    print(f"Result written to {output_path}: {result_value}")

finally:
    # Clean up the sandbox
    if sandbox is not None:
        print(f"Deleting sandbox: {sandbox_name}")
        client.delete_sandbox(sandbox_name)