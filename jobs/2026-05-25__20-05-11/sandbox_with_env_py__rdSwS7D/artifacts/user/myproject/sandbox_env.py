import os
import daytona
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.getenv("ZEALT_RUN_ID")
    if not run_id:
        print("ZEALT_RUN_ID environment variable is not set")
        return

    sandbox_name = f"envvar-py-{run_id}"
    my_var_value = f"hello-{run_id}"
    
    # Initialize Daytona client
    # The DAYTONA_API_KEY is expected to be in the environment
    daytona_client = Daytona()
    
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        env_vars={
            "MY_VAR": my_var_value,
            "APP_MODE": "production"
        }
    )
    
    sandbox = None
    try:
        print(f"Creating sandbox: {sandbox_name}")
        sandbox = daytona_client.create(params)
        print("Sandbox created successfully.")
        
        # Execute shell commands inside the sandbox to read environment variables
        print("Reading environment variables from sandbox...")
        res_my_var = sandbox.process.exec("echo $MY_VAR")
        res_app_mode = sandbox.process.exec("echo $APP_MODE")
        
        # Capture and strip the values
        my_var_captured = res_my_var.result.strip()
        app_mode_captured = res_app_mode.result.strip()
        
        print(f"Captured MY_VAR: {my_var_captured}")
        print(f"Captured APP_MODE: {app_mode_captured}")
        
        # Record the captured values in a local log file
        log_path = "/home/user/myproject/output.log"
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w") as f:
            f.write(f"MY_VAR: {my_var_captured}\n")
            f.write(f"APP_MODE: {app_mode_captured}\n")
        print(f"Values recorded in {log_path}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Delete the sandbox at the end
        if sandbox:
            print(f"Deleting sandbox: {sandbox_name}")
            sandbox.delete()
            print("Sandbox deleted.")

if __name__ == "__main__":
    main()
