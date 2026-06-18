import os
import daytona
from daytona import Daytona, VolumeMount, CreateSandboxFromSnapshotParams
import traceback

def main():
    api_key = os.environ.get("DAYTONA_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")
    
    if not api_key or not run_id:
        print("Missing environment variables DAYTONA_API_KEY or ZEALT_RUN_ID")
        return

    client = Daytona()
    
    volume_name = f"vol-{run_id}"
    sandbox_name = f"vol-py-{run_id}"
    
    try:
        # Get or create volume
        print(f"Getting or creating volume: {volume_name}")
        volume = client.volume.get(volume_name, create=True)
        print(f"Volume ID: {volume.id}, State: {volume.state}")
        
        import time
        while volume.state != "ready":
            if volume.state == "error":
                raise Exception(f"Volume creation failed: {volume.error_reason}")
            print(f"Waiting for volume to be ready (current state: {volume.state})...")
            time.sleep(2)
            volume = client.volume.get(volume_name)

        # Create sandbox with volume mount
        print(f"Creating sandbox: {sandbox_name}")
        mount = VolumeMount(volume_id=volume.id, mount_path="/data")
        # Following hint to use CreateSandboxFromSnapshotParams
        params = CreateSandboxFromSnapshotParams(name=sandbox_name, volumes=[mount])
        
        sandbox = client.create(params=params)
        print(f"Sandbox created: {sandbox.name}")
        
        try:
            # Write marker file
            marker_content = f"persistent {run_id}"
            print(f"Writing marker to /data/marker.txt")
            exec_res = sandbox.process.exec(f"echo '{marker_content}' > /data/marker.txt")
            if exec_res.exit_code != 0:
                print(f"Error writing marker: {exec_res.stderr}")
            
            # Read marker file
            print(f"Reading marker back")
            read_res = sandbox.process.exec("cat /data/marker.txt")
            read_content = read_res.result.strip()
            print(f"Read marker: {read_content}")
            
            # Get volume count
            volumes = client.volume.list()
            volume_count = len(volumes)
            print(f"Volume count: {volume_count}")
            
            # Record in log file
            log_path = "/home/user/myproject/output.log"
            with open(log_path, "w") as f:
                f.write(f"Marker: {read_content}\n")
                f.write(f"VolumeCount: {volume_count}\n")
            
            print(f"Logged results to {log_path}")
            
        finally:
            # Clean up sandbox
            print(f"Deleting sandbox: {sandbox_name}")
            client.delete(sandbox)
            print("Sandbox deleted.")
            
    except Exception as e:
        print(f"An error occurred: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
