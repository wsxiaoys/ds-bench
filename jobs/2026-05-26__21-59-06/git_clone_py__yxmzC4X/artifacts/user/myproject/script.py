import os
from daytona import Daytona, CreateSandboxFromImageParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    sandbox_name = f"git-py-{run_id}"
    log_file = "/home/user/myproject/output.log"
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    daytona = Daytona()
    sandbox = None
    try:
        # Create sandbox
        params = CreateSandboxFromImageParams(
            name=sandbox_name,
            image="daytonaio/workspace-project:latest"
        )
        sandbox = daytona.create(params)
        
        # Clone repo
        sandbox.git.clone("https://github.com/octocat/Hello-World", "/home/daytona/hello-world")
        
        # Get status
        stat = sandbox.git.status("/home/daytona/hello-world")
        branch_name = stat.current_branch
        
        # Get README
        res = sandbox.process.exec("cat /home/daytona/hello-world/README")
        readme_content = res.result
        first_line = readme_content.splitlines()[0] if readme_content else ""
        
        # Write to log
        with open(log_file, "a") as f:
            f.write(f"Branch: {branch_name}\n")
            f.write(f"README: {first_line}\n")
            
    finally:
        if sandbox:
            sandbox.delete()

if __name__ == "__main__":
    main()
