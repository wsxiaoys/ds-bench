#!/usr/bin/env python3
"""
Mount a Daytona Volume to a Sandbox and record marker file contents + volume count.
"""
import os
import sys

from daytona import Daytona, CreateSandboxFromSnapshotParams, VolumeMount

# Read run-id from environment
run_id = os.environ.get("ZEALT_RUN_ID")
if not run_id:
    print("ERROR: ZEALT_RUN_ID environment variable not set", file=sys.stderr)
    sys.exit(1)

volume_name = f"vol-{run_id}"
sandbox_name = f"vol-py-{run_id}"
mount_path = "/data"
marker_text = f"persistent {run_id}"
output_log = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output.log")

print(f"Run ID:      {run_id}")
print(f"Volume name: {volume_name}")
print(f"Sandbox:     {sandbox_name}")

# Initialize the Daytona client (reads DAYTONA_API_KEY from env automatically)
daytona = Daytona()

# --- Step 1: Get or create the volume ---
print(f"\n[1] Getting or creating volume '{volume_name}' ...")
volume = daytona.volume.get(volume_name, create=True)
print(f"    Volume ID: {volume.id}")

# --- Step 2: Create the sandbox with the volume mounted ---
print(f"\n[2] Creating sandbox '{sandbox_name}' with volume mounted at '{mount_path}' ...")
params = CreateSandboxFromSnapshotParams(
    name=sandbox_name,
    volumes=[VolumeMount(volume_id=volume.id, mount_path=mount_path)],
)
sandbox = daytona.create(params)
print(f"    Sandbox ID: {sandbox.id}")

try:
    # --- Step 3: Write the marker file ---
    print(f"\n[3] Writing marker file at '{mount_path}/marker.txt' ...")
    write_cmd = f"echo '{marker_text}' > {mount_path}/marker.txt"
    result = sandbox.process.exec(write_cmd)
    if result.exit_code != 0:
        raise RuntimeError(f"Write command failed (exit {result.exit_code}): {result.result}")
    print("    Written successfully.")

    # --- Step 4: Read the marker file back ---
    print(f"\n[4] Reading marker file back ...")
    read_cmd = f"cat {mount_path}/marker.txt"
    result = sandbox.process.exec(read_cmd)
    if result.exit_code != 0:
        raise RuntimeError(f"Read command failed (exit {result.exit_code}): {result.result}")
    marker_content = result.result.strip()
    print(f"    Marker content: '{marker_content}'")

    # --- Step 5: Count all volumes ---
    print(f"\n[5] Counting all volumes ...")
    volumes = daytona.volume.list()
    volume_count = len(volumes)
    print(f"    Total volumes: {volume_count}")

    # --- Step 6: Write output log ---
    print(f"\n[6] Writing output log to '{output_log}' ...")
    with open(output_log, "w") as f:
        f.write(f"Marker: {marker_content}\n")
        f.write(f"VolumeCount: {volume_count}\n")
    print("    Log written.")

finally:
    # --- Step 7: Clean up the sandbox ---
    print(f"\n[7] Deleting sandbox '{sandbox_name}' ...")
    daytona.delete(sandbox)
    print("    Sandbox deleted.")

print("\nDone!")
print(f"\n--- output.log ---")
with open(output_log) as f:
    print(f.read(), end="")
