import os
from e2b import Sandbox

def main():
    # Get the E2B API Key from environment
    api_key = os.environ.get("E2B_API_KEY")
    if not api_key:
        raise ValueError("E2B_API_KEY environment variable not found")

    # Save the E2B_API_KEY to /home/user/e2b_api_key.txt
    api_key_path = "/home/user/e2b_api_key.txt"
    with open(api_key_path, "w") as f:
        f.write(api_key)
    print(f"Saved E2B_API_KEY to {api_key_path}")

    # Spawn a sandbox from the default template with a timeout of at least 10 minutes (600 seconds)
    print("Spawning sandbox...")
    sandbox = Sandbox.create(timeout=600)
    
    # Get the spawned sandbox ID
    sandbox_id = sandbox.sandbox_id
    print(f"Spawned sandbox ID: {sandbox_id}")

    # Write the spawned sandbox ID to /home/user/sandbox_id.txt
    sandbox_id_path = "/home/user/sandbox_id.txt"
    with open(sandbox_id_path, "w") as f:
        f.write(sandbox_id)
    print(f"Saved sandbox ID to {sandbox_id_path}")

    # In the sandbox, execute the command: echo 'Hello E2B' > /home/user/hello.txt
    print("Executing command in the sandbox...")
    result = sandbox.commands.run("echo 'Hello E2B' > /home/user/hello.txt")
    print(f"Command execution result exit code: {result.exit_code}")
    if result.error:
        print(f"Command error: {result.error}")
    
    # Verify the file was written in the sandbox
    verify_result = sandbox.commands.run("cat /home/user/hello.txt")
    print(f"Verification output from sandbox: {verify_result.stdout.strip()}")

if __name__ == "__main__":
    main()
