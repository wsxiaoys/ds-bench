#!/usr/bin/env python3
"""
Mount a Daytona Volume to a Sandbox

This script demonstrates how to:
1. Get or create a Daytona Volume
2. Create a sandbox with the volume mounted
3. Write and read data from the mounted volume
4. Clean up by deleting the sandbox
"""

import os
import time

from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams, VolumeMount


def main():
    # Get environment variables
    api_key = os.environ.get("DAYTONA_API_KEY")
    run_id = os.environ.get("ZEALT_RUN_ID")

    if not api_key:
        raise ValueError("DAYTONA_API_KEY environment variable is not set")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID environment variable is not set")

    # Initialize Daytona client
    config = DaytonaConfig(api_key=api_key)
    daytona = Daytona(config=config)

    # Resource names
    volume_name = f"vol-{run_id}"
    sandbox_name = f"vol-py-{run_id}"

    print(f"Starting task with run_id: {run_id}")
    print(f"Volume name: {volume_name}")
    print(f"Sandbox name: {sandbox_name}")

    # Step 1: Get or create a volume
    print(f"\n[1/5] Getting or creating volume '{volume_name}'...")
    volume = daytona.volume.get(name=volume_name, create=True)
    print(f"Volume created/retrieved: {volume.name} (ID: {volume.id})")

    # Wait for volume to be ready
    print(f"\nWaiting for volume to be ready...")
    max_wait = 60  # Maximum wait time in seconds
    waited = 0
    while waited < max_wait:
        volume = daytona.volume.get(name=volume_name)
        print(f"Volume state: {volume.state}")
        if volume.state == "ready":
            print("Volume is ready!")
            break
        time.sleep(5)
        waited += 5
    else:
        raise Exception(f"Volume did not become ready within {max_wait} seconds")

    # Step 2: Create a sandbox with the volume mounted
    print(f"\n[2/5] Creating sandbox '{sandbox_name}' with volume mounted at /data...")
    
    # Create volume mount
    volume_mount = VolumeMount(volume_id=volume.id, mount_path="/data")
    
    # Create sandbox with volume mount
    create_params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        volumes=[volume_mount]
    )
    
    sandbox = daytona.create(params=create_params)
    print(f"Sandbox created: {sandbox.name} (ID: {sandbox.id})")

    # Wait for sandbox to be ready
    print(f"\n[3/5] Waiting for sandbox to be ready...")
    time.sleep(10)  # Give sandbox time to initialize

    # Step 4: Write a marker file to the mounted volume
    marker_content = f"persistent {run_id}"
    marker_path = "/data/marker.txt"
    
    print(f"\n[4/5] Writing marker file to {marker_path}...")
    print(f"Content: {marker_content}")
    
    # Write the marker file using process.exec
    write_result = sandbox.process.exec(
        command=f"echo '{marker_content}' > {marker_path}"
    )
    print(f"Write result exit code: {write_result.exit_code}")

    # Read the marker file back
    print(f"\nReading marker file from {marker_path}...")
    read_result = sandbox.process.exec(
        command=f"cat {marker_path}"
    )
    
    # Get the output
    marker_read_content = read_result.result.strip()
    print(f"Read content: {marker_read_content}")

    # Step 5: Get the total number of volumes
    print(f"\n[5/5] Getting total number of volumes...")
    volumes = daytona.volume.list()
    volume_count = len(volumes)
    print(f"Total volumes: {volume_count}")

    # Write results to log file
    log_path = "/home/user/myproject/output.log"
    print(f"\nWriting results to {log_path}...")
    
    with open(log_path, "w") as f:
        f.write(f"Marker: {marker_read_content}\n")
        f.write(f"VolumeCount: {volume_count}\n")
    
    print("Log file written successfully")

    # Clean up: Delete the sandbox
    print(f"\nCleaning up: Deleting sandbox '{sandbox_name}'...")
    daytona.delete(sandbox=sandbox)
    print(f"Sandbox deleted successfully")

    print(f"\nTask completed successfully!")
    print(f"Volume '{volume_name}' still exists for persistence.")
    print(f"Results logged to: {log_path}")


if __name__ == "__main__":
    main()