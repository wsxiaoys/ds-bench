import json
import os
import e2b

def main():
    # 1. Ensure the E2B_API_KEY is present
    api_key = os.environ.get("E2B_API_KEY")
    if not api_key:
        print("Error: E2B_API_KEY environment variable is not set.")
        return

    print("Creating E2B sandbox...")
    # 2. Create the sandbox with specified environment variables
    # We can also pass a longer timeout (e.g., 3600 seconds / 1 hour)
    sandbox = e2b.Sandbox.create(
        envs={
            "SECRET_TOKEN": "super-secret-123",
            "API_ENDPOINT": "https://api.example.com"
        },
        timeout=3600
    )
    
    sandbox_id = sandbox.sandbox_id
    print(f"Sandbox created successfully with ID: {sandbox_id}")

    # 3. Execute command to write the env values to /home/user/env_dump.txt
    # We first ensure /home/user directory exists inside the sandbox, 
    # then write the env variables in the specified format.
    cmd = (
        "mkdir -p /home/user && "
        "echo \"TOKEN=$SECRET_TOKEN\" > /home/user/env_dump.txt && "
        "echo \"ENDPOINT=$API_ENDPOINT\" >> /home/user/env_dump.txt"
    )
    
    print(f"Running command inside sandbox: {cmd}")
    result = sandbox.commands.run(cmd)
    
    print(f"Command exit code: {result.exit_code}")
    print(f"Command stdout:\n{result.stdout}")
    print(f"Command stderr:\n{result.stderr}")
    
    if result.exit_code != 0:
        print("Error: Command failed inside the sandbox.")
        return

    # Verify the file was written correctly by catting it
    verify_cmd = "cat /home/user/env_dump.txt"
    verify_result = sandbox.commands.run(verify_cmd)
    print(f"Verifying file content in sandbox:\n{verify_result.stdout}")

    # 4. Save the sandbox ID to /home/user/e2b_task_info.json on the host machine
    info_path = "/home/user/e2b_task_info.json"
    info_data = {"sandbox_id": sandbox_id}
    
    print(f"Saving sandbox ID to {info_path} on the host machine...")
    with open(info_path, "w") as f:
        json.dump(info_data, f, indent=2)
        
    print("Done!")

if __name__ == "__main__":
    main()
