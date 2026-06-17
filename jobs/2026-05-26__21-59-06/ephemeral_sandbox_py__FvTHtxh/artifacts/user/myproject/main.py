import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run")
    name = f"ephem-py-{run_id}"
    
    daytona = Daytona()
    
    params = CreateSandboxFromSnapshotParams(
        name=name,
        ephemeral=True,
        auto_stop_interval=5
    )
    
    sandbox = daytona.create(params)
    
    try:
        response = sandbox.process.exec("date +%Y")
        year = response.result.strip()
        
        sandbox_meta = daytona.get(sandbox.id)
        auto_stop_interval = sandbox_meta.auto_stop_interval
        
        with open("/home/user/myproject/output.log", "w") as f:
            f.write(f"Year: {year}\n")
            f.write(f"AutoStop: {auto_stop_interval}\n")
    finally:
        sandbox.stop()

if __name__ == "__main__":
    main()
