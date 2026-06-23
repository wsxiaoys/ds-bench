import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.getenv("ZEALT_RUN_ID")
    if not run_id:
        print("ZEALT_RUN_ID not set")
        sys.exit(1)

    project_dir = "/home/user/myproject"
    input_file_path = os.path.join(project_dir, "input.txt")
    output_file_path = os.path.join(project_dir, "output.txt")
    log_file_path = os.path.join(project_dir, "output.log")
    
    input_content = f"Hello Daytona {run_id}"
    
    # Create local input file
    with open(input_file_path, "w") as f:
        f.write(input_content)
    
    daytona = Daytona()
    sandbox_name = f"fs-py-{run_id}"
    
    sandbox = None
    try:
        print(f"Creating sandbox: {sandbox_name}")
        # Using a known working snapshot
        sandbox = daytona.create(CreateSandboxFromSnapshotParams(
            name=sandbox_name, 
            snapshot='daytonaio/sandbox:0.8.0'
        ))
        
        remote_input_path = "/home/daytona/input.txt"
        remote_output_path = "/home/daytona/output.txt"
        
        print(f"Uploading file {input_file_path} to {remote_input_path}")
        sandbox.fs.upload_file(input_file_path, remote_input_path)
        
        print("Running transformation command")
        # tr '[:lower:]' '[:upper:]' < input.txt > output.txt
        sandbox.process.exec(f"tr '[:lower:]' '[:upper:]' < {remote_input_path} > {remote_output_path}")
        
        print(f"Downloading file from {remote_output_path}")
        output_bytes = sandbox.fs.download_file(remote_output_path)
        
        if output_bytes is None:
            raise Exception("Failed to download file: received None")
            
        with open(output_file_path, "wb") as f:
            f.write(output_bytes)
            
        print("Writing to log file")
        with open(log_file_path, "a") as f:
            f.write("Upload+Download OK\n")
            
        print("Success!")
        
    except Exception as e:
        print(f"Error: {e}")
        # Even if error occurs, we should try to delete the sandbox if it was created
        # But the finally block handles it.
        sys.exit(1)
    finally:
        if sandbox:
            print(f"Deleting sandbox: {sandbox_name}")
            try:
                daytona.delete(sandbox)
            except Exception as delete_error:
                print(f"Error deleting sandbox: {delete_error}")

if __name__ == "__main__":
    main()
