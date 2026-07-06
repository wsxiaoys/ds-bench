import os
import sys
from daytona import Daytona, DaytonaConfig, VolumeMount, CreateSandboxFromSnapshotParams

# Read run-id
with open('/logs/artifacts/run-id', 'r') as f:
    run_id = f.read().strip()

print(f"run-id: {run_id}")

# Authenticate via DAYTONA_API_KEY env var (Daytona reads it)
config = DaytonaConfig(
    api_key=os.environ.get('DAYTONA_API_KEY'),
    organization_id=os.environ.get('DAYTONA_ORGANIZATION_ID'),
)
daytona = Daytona(config)

volume_name = f"vol-{run_id}"
sandbox_name = f"vol-py-{run_id}"
marker_content = f"persistent {run_id}"

print(f"Volume name: {volume_name}")
print(f"Sandbox name: {sandbox_name}")
print(f"Marker content: {marker_content}")

# Get-or-create volume
volume = daytona.volume.get(volume_name, create=True)
print(f"Got volume: {volume.name} (id={volume.id})")

# Create sandbox with mounted volume
params = CreateSandboxFromSnapshotParams(
    name=sandbox_name,
    volumes=[VolumeMount(volume_id=volume.id, mount_path="/data")],
)
sandbox = daytona.create(params)
print(f"Created sandbox: {sandbox.id}")

try:
    # Write marker file on the mounted volume
    write_sh = f"mkdir -p /data && printf '%s' '{marker_content}' > /data/marker.txt"
    result = sandbox.process.exec(write_sh)
    print(f"write stdout: {result.result!r}")
    print(f"write exit_code: {result.exit_code}")
    if result.exit_code != 0:
        raise RuntimeError("write failed")

    # Read marker back
    read_result = sandbox.process.exec("cat /data/marker.txt")
    read_back = read_result.result
    print(f"Read back: {read_back!r}")

    # Get total volume count
    volumes = daytona.volume.list()
    vol_count = len(volumes)
    print(f"Volume count: {vol_count}")

    # Write output log
    os.makedirs('/home/user/myproject', exist_ok=True)
    with open('/home/user/myproject/output.log', 'w') as f:
        f.write(f"Marker: {read_back}\n")
        f.write(f"VolumeCount: {vol_count}\n")

    print("Wrote output.log")
    print(open('/home/user/myproject/output.log').read())
finally:
    # Clean up sandbox
    print("Deleting sandbox...")
    try:
        daytona.delete(sandbox)
        print("Sandbox deleted.")
    except Exception as e:
        print(f"Error deleting sandbox: {e}")
