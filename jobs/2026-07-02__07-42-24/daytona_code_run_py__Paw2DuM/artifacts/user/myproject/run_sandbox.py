import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Read run-id
    with open('/logs/artifacts/run-id', 'r') as f:
        run_id = f.read().strip()

    sandbox_name = f"code-run-py-{run_id}"

    daytona = Daytona()
    sandbox = None

    try:
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        print(f"Creating sandbox: {sandbox_name}")
        sandbox = daytona.create(params)
        print(f"Sandbox created: {sandbox.id}")
        
        # Run code run
        code = """
total = sum(range(1, 101))
print(total)
"""
        print("Running Python snippet inside sandbox...")
        response = sandbox.process.code_run(code)
        print(f"Exit code: {response.exit_code}")
        print(f"Result: {response.result}")
        
        output_val = response.result.strip()
        
        # Write result to /home/user/myproject/output.log
        output_path = "/home/user/myproject/output.log"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(f"Result: {output_val}\n")
        print(f"Result written to {output_path}")

    finally:
        if sandbox is not None:
            print(f"Deleting sandbox: {sandbox_name}")
            daytona.delete(sandbox)
            print("Sandbox deleted.")

if __name__ == "__main__":
    main()
