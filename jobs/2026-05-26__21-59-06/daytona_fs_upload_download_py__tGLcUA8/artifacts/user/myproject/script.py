import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    sandbox_name = f"fs-py-{run_id}"
    
    project_dir = "/home/user/myproject"
    os.makedirs(project_dir, exist_ok=True)
    
    local_input = os.path.join(project_dir, "input.txt")
    local_output = os.path.join(project_dir, "output.txt")
    log_file = os.path.join(project_dir, "output.log")
    
    # Create local input file
    with open(local_input, "w") as f:
        f.write(f"Hello Daytona {run_id}")
        
    daytona = Daytona()
    sandbox = daytona.create(CreateSandboxFromSnapshotParams(name=sandbox_name, language="python"))
    
    try:
        work_dir = sandbox.get_work_dir().rstrip('/')
        remote_input = f"{work_dir}/input.txt"
        remote_output = f"{work_dir}/output.txt"
        
        # Upload local file to sandbox
        sandbox.fs.upload_file(local_input, remote_input)
        
        # Process in sandbox
        sandbox.process.exec(f"tr '[:lower:]' '[:upper:]' < {remote_input} > {remote_output}")
        
        # Download transformed file
        out_bytes = sandbox.fs.download_file(remote_output)
        
        if out_bytes is not None:
            with open(local_output, "wb") as f:
                f.write(out_bytes)
                
        # Write confirmation
        with open(log_file, "a") as f:
            f.write("Upload+Download OK\n")
            
    finally:
        daytona.delete(sandbox)

if __name__ == "__main__":
    main()
