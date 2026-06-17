import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default")
    sandbox_name = f"envvar-py-{run_id}"
    
    daytona = Daytona()
    sandbox = None
    try:
        print("Creating sandbox...")
        sandbox = daytona.create(
            CreateSandboxFromSnapshotParams(
                name=sandbox_name,
                env_vars={
                    "MY_VAR": f"hello-{run_id}",
                    "APP_MODE": "production"
                }
            )
        )
        print("Sandbox created.")
        
        my_var_res = sandbox.process.exec("printenv MY_VAR")
        app_mode_res = sandbox.process.exec("printenv APP_MODE")
        
        my_var = my_var_res.result.strip() if my_var_res.result else ""
        app_mode = app_mode_res.result.strip() if app_mode_res.result else ""
        
        print(f"MY_VAR: {my_var}")
        print(f"APP_MODE: {app_mode}")
        
        with open("output.log", "w") as f:
            f.write(f"MY_VAR: {my_var}\n")
            f.write(f"APP_MODE: {app_mode}\n")
            
    finally:
        if sandbox:
            print("Deleting sandbox...")
            sandbox.delete()
            print("Sandbox deleted.")

if __name__ == "__main__":
    main()
