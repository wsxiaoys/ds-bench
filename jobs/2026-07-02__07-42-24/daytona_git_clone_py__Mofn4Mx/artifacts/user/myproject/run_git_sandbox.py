import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # 1. Read run-id
    try:
        with open("/logs/artifacts/run-id", "r") as f:
            run_id = f.read().strip()
    except Exception as e:
        print(f"Error reading run-id: {e}", file=sys.stderr)
        sys.exit(1)

    sandbox_name = f"git-py-{run_id}"
    print(f"Using sandbox name: {sandbox_name}")

    # 2. Ensure output directory exists and prepare log file
    output_dir = "/home/user/myproject"
    os.makedirs(output_dir, exist_ok=True)
    log_file_path = os.path.join(output_dir, "output.log")
    
    # Initialize the log file (clear it if it exists)
    with open(log_file_path, "w") as f:
        pass

    # 3. Initialize Daytona client
    print("Initializing Daytona client...")
    daytona = Daytona()
    
    sandbox = None
    try:
        # 4. Create sandbox
        print(f"Creating sandbox '{sandbox_name}'...")
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = daytona.create(params)
        print(f"Sandbox created successfully. ID: {sandbox.id}")

        # 5. Clone public repository
        repo_url = "https://github.com/octocat/Hello-World"
        clone_path = "/home/daytona/hello-world"
        print(f"Cloning repository {repo_url} into {clone_path}...")
        sandbox.git.clone(url=repo_url, path=clone_path)
        print("Repository cloned successfully.")

        # 6. Call sandbox.git.status and write current branch name to output.log
        print("Getting repository status...")
        status = sandbox.git.status(path=clone_path)
        branch_name = status.current_branch
        print(f"Current branch: {branch_name}")
        
        with open(log_file_path, "a") as f:
            f.write(f"Branch: {branch_name}\n")

        # 7. Read README file and append first line to output.log
        print("Reading README file...")
        readme_content = None
        
        # Try downloading the file using sandbox.fs.download_file
        try:
            readme_path = f"{clone_path}/README"
            print(f"Attempting to download README via fs.download_file from {readme_path}...")
            readme_bytes = sandbox.fs.download_file(readme_path)
            if readme_bytes:
                readme_content = readme_bytes.decode("utf-8")
                print("Successfully downloaded README via fs.download_file.")
        except Exception as e:
            print(f"Warning: Failed to download README via fs.download_file: {e}")

        # Fallback to sandbox.process.exec if download_file failed or returned empty
        if not readme_content:
            try:
                print("Attempting to cat README via process.exec...")
                exec_res = sandbox.process.exec(f"cat {clone_path}/README")
                if exec_res.exit_code == 0:
                    readme_content = exec_res.result
                    print("Successfully read README via process.exec.")
                else:
                    print(f"Warning: process.exec 'cat' exited with code {exec_res.exit_code}")
            except Exception as e:
                print(f"Warning: Failed to read README via process.exec: {e}")

        if readme_content:
            # Get the first line
            first_line = readme_content.splitlines()[0] if readme_content.splitlines() else ""
            print(f"First line of README: {first_line}")
            with open(log_file_path, "a") as f:
                f.write(f"README: {first_line}\n")
        else:
            print("Error: Could not read README content.", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"An error occurred during sandbox operations: {e}", file=sys.stderr)
        sys.exit(1)

    finally:
        # 8. Delete the sandbox
        if sandbox:
            print(f"Cleaning up: Deleting sandbox '{sandbox_name}'...")
            try:
                daytona.delete(sandbox)
                print("Sandbox deleted successfully.")
            except Exception as e:
                print(f"Error deleting sandbox: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
