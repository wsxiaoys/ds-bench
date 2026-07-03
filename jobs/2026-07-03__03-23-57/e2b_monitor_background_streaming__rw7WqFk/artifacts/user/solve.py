import json
from e2b import Sandbox

def main():
    # 1. Create a new E2B sandbox.
    print("Creating a new E2B sandbox...")
    sandbox = Sandbox.create()
    sandbox_id = sandbox.sandbox_id
    print(f"Sandbox created with ID: {sandbox_id}")

    # 2. Save the created sandbox ID to a local file `/home/user/e2b_task_info.json` under the key `sandbox_id`.
    task_info_path = "/home/user/e2b_task_info.json"
    task_info = {"sandbox_id": sandbox_id}
    with open(task_info_path, "w") as f:
        json.dump(task_info, f, indent=2)
    print(f"Saved sandbox ID to {task_info_path}")

    # 3. Inside the sandbox, create a bash script at `/home/user/task.sh` with the exact content.
    task_script_content = """#!/bin/bash
echo 'Initializing...'
sleep 1
echo 'Running background job...'
sleep 1
echo 'Job complete.'
"""
    print("Writing task.sh inside the sandbox...")
    sandbox.files.write("/home/user/task.sh", task_script_content)

    # 4. Make the script executable (`chmod +x /home/user/task.sh`) inside the sandbox.
    print("Making task.sh executable...")
    sandbox.commands.run("chmod +x /home/user/task.sh")

    # 5. Run the script as a background command using the E2B SDK.
    print("Running task.sh in the background...")
    command = sandbox.commands.run("/home/user/task.sh", background=True)

    # 6. Monitor or wait for the background command to finish, capturing its stdout.
    print("Waiting for the background command to finish...")
    result = command.wait()
    captured_stdout = result.stdout
    print("Captured stdout:")
    print(captured_stdout)

    # 7. Write the captured stdout to a file inside the sandbox at `/home/user/captured_stdout.txt`.
    print("Writing captured stdout inside the sandbox...")
    sandbox.files.write("/home/user/captured_stdout.txt", captured_stdout)

    # 8. Do not close or kill the sandbox at the end of the script.
    print("Task execution finished. Sandbox is left running.")

if __name__ == "__main__":
    main()
