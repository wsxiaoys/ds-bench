import os
import sys
import time
from daytona import Daytona, VolumeMount, CreateSandboxFromSnapshotParams, CreateSandboxFromImageParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ZEALT_RUN_ID not set")
        sys.exit(1)

    daytona = Daytona()
    
    vol_name = f"vol-{run_id}"
    sandbox_name = f"vol-py-{run_id}"
    
    print(f"Creating/getting volume {vol_name}...")
    vol = daytona.volume.get(vol_name, create=True)
    print(f"Volume created/got: {vol}")
    
    # Wait for volume to be ready
    while vol.state.value != 'ready':
        print(f"Volume state is {vol.state.value}, waiting...")
        time.sleep(2)
        vol = daytona.volume.get(vol_name)
    
    print("Volume is ready.")
    
    print(f"Creating sandbox {sandbox_name}...")
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        volumes=[VolumeMount(volume_id=vol.id, mount_path="/data")]
    )
    
    try:
        sandbox = daytona.create(params)
    except Exception as e:
        print(f"Failed to create from snapshot params: {e}")
        print("Trying CreateSandboxFromImageParams instead...")
        params = CreateSandboxFromImageParams(
            name=sandbox_name,
            image="ubuntu:22.04",
            volumes=[VolumeMount(volume_id=vol.id, mount_path="/data")]
        )
        sandbox = daytona.create(params)
        
    print(f"Sandbox created: {sandbox}")
    
    print("Writing to marker file...")
    write_cmd = f"echo 'persistent {run_id}' > /data/marker.txt"
    response = sandbox.process.exec(write_cmd)
    if response.exit_code != 0:
        print(f"Failed to write to marker file: {response.result}")
        
    print("Reading from marker file...")
    read_cmd = "cat /data/marker.txt"
    response = sandbox.process.exec(read_cmd)
    if response.exit_code != 0:
        print(f"Failed to read from marker file: {response.result}")
        sys.exit(1)
        
    marker_content = response.result.strip()
    print(f"Marker content: {marker_content}")
    
    print("Counting volumes...")
    volumes = daytona.volume.list()
    vol_count = len(volumes)
    print(f"Volume count: {vol_count}")
    
    print("Writing to log file...")
    with open("/home/user/myproject/output.log", "w") as f:
        f.write(f"Marker: {marker_content}\n")
        f.write(f"VolumeCount: {vol_count}\n")
        
    print("Deleting sandbox...")
    daytona.delete(sandbox)
    print("Done.")

if __name__ == "__main__":
    main()
