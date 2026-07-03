import json
import os
from e2b import Sandbox

def main():
    print("Creating E2B Sandbox...")
    # 1. Create an E2B Sandbox with a timeout of 600 seconds
    sandbox = Sandbox.create(timeout=600)
    sandbox_id = sandbox.sandbox_id
    print(f"Sandbox created with ID: {sandbox_id}")

    try:
        # 2. Inside the sandbox, create a bash script at /home/user/scan_network.sh
        bash_script_path = "/home/user/scan_network.sh"
        bash_script_content = """#!/bin/bash
echo 'Scanning open ports...'
echo 'Found vulnerable port 8080' >&2
echo 'Scan complete. 1 vulnerabilities found.'
"""
        print(f"Creating script at {bash_script_path} inside the sandbox...")
        sandbox.files.write(bash_script_path, bash_script_content)

        # 3. Change the permissions of /home/user/scan_network.sh to make it executable
        print("Making the script executable...")
        sandbox.commands.run(f"chmod +x {bash_script_path}")

        # 4. Execute the script /home/user/scan_network.sh inside the sandbox using the SDK
        print("Executing the script inside the sandbox...")
        result = sandbox.commands.run(bash_script_path)

        # 5. Capture the stdout and stderr from the command execution
        stdout = result.stdout
        stderr = result.stderr
        print("Captured STDOUT:")
        print(stdout)
        print("Captured STDERR:")
        print(stderr)

        # 6. Write a file inside the sandbox at /home/user/scan_results.txt
        # containing the captured outputs in the specified format
        scan_results_path = "/home/user/scan_results.txt"
        results_content = f"STDOUT:\n{stdout}STDERR:\n{stderr}"
        print(f"Writing results to {scan_results_path} inside the sandbox...")
        sandbox.files.write(scan_results_path, results_content)

        # 7. Save the created sandbox ID to a local file at /home/user/e2b_task_info.json
        local_info_path = "/home/user/e2b_task_info.json"
        task_info = {
            "sandbox_id": sandbox_id
        }
        print(f"Saving sandbox ID to local file {local_info_path}...")
        with open(local_info_path, "w") as f:
            json.dump(task_info, f, indent=4)

        print("All operations completed successfully!")

    except Exception as e:
        print(f"An error occurred: {e}")
        raise e

if __name__ == "__main__":
    main()
