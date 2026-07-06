import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    # 1. Read run-id
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: {run_id_path} not found.")
        sys.exit(1)
        
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
    
    print(f"Read run-id: {run_id}")
    
    # 2. Create local input file
    project_dir = "/home/user/myproject"
    os.makedirs(project_dir, exist_ok=True)
    
    local_input_path = os.path.join(project_dir, "input.txt")
    local_output_path = os.path.join(project_dir, "output.txt")
    local_log_path = os.path.join(project_dir, "output.log")
    
    input_content = f"Hello Daytona {run_id}"
    with open(local_input_path, "w") as f:
        f.write(input_content)
    
    print(f"Created local input file at {local_input_path} with content: '{input_content}'")
    
    # 3. Initialize Daytona
    daytona = Daytona()
    sandbox_name = f"fs-py-{run_id}"
    print(f"Provisioning sandbox with name: {sandbox_name}")
    
    # Create sandbox from snapshot params with the specific name
    params = CreateSandboxFromSnapshotParams(name=sandbox_name)
    sandbox = daytona.create(params)
    
    try:
        print(f"Sandbox '{sandbox.name}' (ID: {sandbox.id}) created successfully.")
        
        # 4. Upload file to sandbox
        print(f"Uploading {local_input_path} to sandbox...")
        sandbox.fs.upload_file(local_input_path, "input.txt")
        print("Upload successful.")
        
        # 5. Transform file inside sandbox
        print("Running transformation command inside sandbox...")
        exec_res = sandbox.process.exec("tr '[:lower:]' '[:upper:]' < input.txt > output.txt")
        if exec_res.exit_code != 0:
            raise Exception(f"Transformation failed inside sandbox with exit code {exec_res.exit_code}. Output: {exec_res.artifacts.stdout}")
        print("Transformation successful.")
        
        # 6. Download transformed file back
        print(f"Downloading output.txt from sandbox to {local_output_path}...")
        sandbox.fs.download_file("output.txt", local_output_path)
        print("Download successful.")
        
        # 7. Write confirmation line to log file
        with open(local_log_path, "w") as f:
            f.write("Upload+Download OK\n")
        print(f"Written confirmation to {local_log_path}")
        
    except Exception as e:
        print(f"An error occurred during sandbox operations: {e}")
        raise e
    finally:
        # 8. Clean up / Delete sandbox
        print(f"Deleting sandbox '{sandbox_name}'...")
        try:
            daytona.delete(sandbox)
            print("Sandbox deleted successfully.")
        except Exception as delete_err:
            print(f"Error deleting sandbox: {delete_err}")

if __name__ == "__main__":
    main()
