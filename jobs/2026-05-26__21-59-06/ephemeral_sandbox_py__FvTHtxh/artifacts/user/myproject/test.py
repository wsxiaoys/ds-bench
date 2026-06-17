import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run")
    name = f"ephem-py-{run_id}"
    
    daytona = Daytona()
    
    params = CreateSandboxFromSnapshotParams(
        name=name,
        ephemeral=True,
        auto_stop_interval=5
    )
    
    print("Creating sandbox...")
    sandbox = daytona.create(params)
    print(f"Sandbox created: {sandbox.id}")
    
    try:
        response = sandbox.process.exec("date +%Y")
        print(f"Result: {response.result}")
        
        sandbox_meta = daytona.get(sandbox.id)
        print(f"Auto stop interval: {sandbox_meta.auto_stop_interval}")
    finally:
        print("Stopping sandbox...")
        sandbox.stop()

if __name__ == "__main__":
    main()
