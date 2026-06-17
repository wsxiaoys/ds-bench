import os
import sys
from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID")
    api_key = os.environ.get("DAYTONA_API_KEY")
    
    if not run_id:
        print("ZEALT_RUN_ID not set")
        sys.exit(1)
    if not api_key:
        print("DAYTONA_API_KEY not set")
        sys.exit(1)

    sandbox_name = f"git-py-{run_id}"
    log_file_path = "/home/user/myproject/output.log"
    
    # Initialize Daytona client
    config = DaytonaConfig(api_key=api_key)
    client = Daytona(config)
    
    sandbox = None
    try:
        print(f"Creating sandbox: {sandbox_name}")
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = client.create(params)
        
        repo_url = "https://github.com/octocat/Hello-World"
        target_path = "/home/daytona/hello-world"
        
        print(f"Cloning {repo_url} into {target_path}")
        sandbox.git.clone(repo_url, target_path)
        
        print("Getting git status")
        status = sandbox.git.status(target_path)
        
        # Try to find the branch name
        branch_name = "unknown"
        if hasattr(status, 'branch'):
            branch_name = status.branch
        elif hasattr(status, 'current_branch'):
            branch_name = status.current_branch
        
        # If it's still unknown, maybe it's master (Hello-World default)
        # But we should report what the SDK says.
        # Let's try to print all attributes of status for debugging if it's unknown
        if branch_name == "unknown" or not branch_name:
             print(f"Status object attributes: {dir(status)}")
             # Often GitStatus has 'branch' but it might be empty if not initialized?
             # Let's try to get it from process.exec as a fallback if SDK fails
             res_branch = sandbox.process.exec(f"git -C {target_path} branch --show-current")
             branch_name = getattr(res_branch, 'result', getattr(res_branch, 'stdout', '')).strip()

        print(f"Branch: {branch_name}")
        with open(log_file_path, "w") as f:
            f.write(f"Branch: {branch_name}\n")
            
        print("Reading README")
        res = sandbox.process.exec(f"head -n 1 {target_path}/README")
        first_line = getattr(res, 'result', getattr(res, 'stdout', '')).strip()
        
        print(f"README: {first_line}")
        with open(log_file_path, "a") as f:
            f.write(f"README: {first_line}\n")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if sandbox:
            print(f"Deleting sandbox: {sandbox_name}")
            try:
                # Daytona.delete takes the sandbox object
                client.delete(sandbox)
            except Exception as e:
                print(f"Failed to delete sandbox: {e}")

if __name__ == "__main__":
    main()
