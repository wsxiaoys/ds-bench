import os
import sys
import daytona

def main():
    # 1. Read run-id
    run_id_path = "/logs/artifacts/run-id"
    if not os.path.exists(run_id_path):
        print(f"Error: Run ID path {run_id_path} does not exist.")
        sys.exit(1)
        
    with open(run_id_path, "r") as f:
        run_id = f.read().strip()
        
    print(f"Using run-id: {run_id}")
    
    # 2. Authenticate and initialize Daytona client
    client = daytona.Daytona()
    
    # 3. Get-or-create Daytona Volume named vol-<run-id>
    volume_name = f"vol-{run_id}"
    print(f"Getting or creating volume: {volume_name}")
    volume = client.volume.get(volume_name, create=True)
    print(f"Volume retrieved: {volume}")
    
    # 4. Create fresh sandbox named vol-py-<run-id> with volume mounted at /data
    sandbox_name = f"vol-py-{run_id}"
    print(f"Creating sandbox: {sandbox_name}")
    
    volume_mount = daytona.VolumeMount(volume_id=volume.id, mount_path="/data")
    params = daytona.CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        volumes=[volume_mount]
    )
    
    sandbox = client.create(params)
    print(f"Sandbox created: {sandbox.id} - State: {sandbox.state}")
    
    try:
        # 5. Write marker file at /data/marker.txt inside the sandbox
        write_content = f"persistent {run_id}"
        print(f"Writing marker to sandbox: '{write_content}'")
        
        # We write to /data/marker.txt
        write_cmd = f"echo '{write_content}' > /data/marker.txt"
        write_resp = sandbox.process.exec(write_cmd)
        print(f"Write Exit Code: {write_resp.exit_code}")
        print(f"Write Output: {write_resp.result}")
        
        # Read it back
        read_cmd = "cat /data/marker.txt"
        read_resp = sandbox.process.exec(read_cmd)
        print(f"Read Exit Code: {read_resp.exit_code}")
        print(f"Read Output: {read_resp.result}")
        
        marker_content = read_resp.result.strip()
        print(f"Marker content read back: '{marker_content}'")
        
        # 6. Count Daytona volumes
        volumes = list(client.volume.list())
        volume_count = len(volumes)
        print(f"Total Daytona volumes visible: {volume_count}")
        
        # 7. Record to /home/user/myproject/output.log
        output_dir = "/home/user/myproject"
        os.makedirs(output_dir, exist_ok=True)
        output_log_path = os.path.join(output_dir, "output.log")
        
        with open(output_log_path, "w") as out_f:
            out_f.write(f"Marker: {marker_content}\n")
            out_f.write(f"VolumeCount: {volume_count}\n")
            
        print(f"Successfully wrote output.log at {output_log_path}")
        
    finally:
        # 8. Clean up by deleting the sandbox
        print(f"Deleting sandbox: {sandbox_name}")
        client.delete(sandbox)
        print("Sandbox deleted successfully.")

if __name__ == "__main__":
    main()
