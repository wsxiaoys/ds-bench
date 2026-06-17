import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # Read run-id from the ZEALT_RUN_ID environment variable
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("Error: ZEALT_RUN_ID environment variable not set.")
        sys.exit(1)

    sandbox_name = f"exec-py-{run_id}"
    project_path = "/home/user/myproject"
    log_file_path = os.path.join(project_path, "output.log")

    # Ensure the directory exists
    os.makedirs(project_path, exist_ok=True)

    # Initialize the synchronous Daytona client
    daytona = Daytona()
    sandbox = None

    try:
        # Create a new sandbox whose name is exec-py-${run-id}
        print(f"Creating sandbox: {sandbox_name}...")
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = daytona.create(params)

        # Execute uname -a inside the sandbox
        print("Executing uname -a...")
        uname_res = sandbox.process.exec("uname -a")
        
        # Execute pwd inside the sandbox
        print("Executing pwd...")
        pwd_res = sandbox.process.exec("pwd")
        
        # Execute echo ${ZEALT_RUN_ID} inside the sandbox
        # The value of ZEALT_RUN_ID from the local environment is echoed back
        print(f"Executing echo {run_id}...")
        echo_res = sandbox.process.exec(f"echo {run_id}")

        # Persist the results to a local log file at /home/user/myproject/output.log
        # One prefixed line per command, in the order they were run.
        with open(log_file_path, "w") as f:
            f.write(f"UNAME: {uname_res.result.strip()}\n")
            f.write(f"PWD: {pwd_res.result.strip()}\n")
            f.write(f"ECHO: {echo_res.result.strip()}\n")
        
        print(f"Results written to {log_file_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
    finally:
        # Delete the sandbox at the end of the run, even on partial failure
        if sandbox:
            print(f"Deleting sandbox: {sandbox_name}...")
            daytona.delete(sandbox)
            print("Sandbox deleted.")

if __name__ == "__main__":
    main()
