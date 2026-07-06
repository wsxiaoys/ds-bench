#!/usr/bin/env python3
"""Mount a Daytona Volume to a Sandbox and verify persistence via a marker file."""

import sys

from daytona import (
    CreateSandboxFromSnapshotParams,
    Daytona,
    VolumeMount,
)

RUN_ID_PATH = "/logs/artifacts/run-id"
LOG_PATH = "/home/user/myproject/output.log"


def main() -> int:
    # Read the run-id (strip any trailing whitespace/newlines).
    with open(RUN_ID_PATH, "r", encoding="utf-8") as f:
        run_id = f.read().strip()

    volume_name = f"vol-{run_id}"
    sandbox_name = f"vol-py-{run_id}"
    marker_text = f"persistent {run_id}"

    # Authenticate using DAYTONA_API_KEY from the environment.
    daytona = Daytona()

    # Get-or-create the volume in one call.
    volume = daytona.volume.get(volume_name, create=True)
    print(f"Volume ready: {volume.name} (id={volume.id}, state={volume.state})")

    # Create a fresh sandbox that mounts the volume at /data.
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        volumes=[VolumeMount(volume_id=volume.id, mount_path="/data")],
    )
    sandbox = daytona.create(params, timeout=120)
    print(f"Sandbox created: {sandbox.id} (name={sandbox_name})")

    try:
        # Write the marker file on the mounted volume.
        write_cmd = f"printf '%s' '{marker_text}' > /data/marker.txt"
        write_resp = sandbox.process.exec(write_cmd, timeout=30)
        if write_resp.exit_code != 0:
            print(f"Write failed (exit {write_resp.exit_code}): {write_resp.result}", file=sys.stderr)
            return 1
        print(f"Wrote marker to /data/marker.txt")

        # Read the marker file back from the mounted volume.
        read_resp = sandbox.process.exec("cat /data/marker.txt", timeout=30)
        if read_resp.exit_code != 0:
            print(f"Read failed (exit {read_resp.exit_code}): {read_resp.result}", file=sys.stderr)
            return 1
        marker_content = read_resp.result
        print(f"Read marker back: {marker_content!r}")

        # Enumerate volumes visible to the account.
        volumes = daytona.volume.list()
        volume_count = len(volumes)
        print(f"Volume count: {volume_count}")

        # Record results to the log file (exactly two lines).
        with open(LOG_PATH, "w", encoding="utf-8") as f:
            f.write(f"Marker: {marker_content}\n")
            f.write(f"VolumeCount: {volume_count}\n")
        print(f"Wrote log to {LOG_PATH}")

    finally:
        # Clean up the sandbox.
        print("Deleting sandbox...")
        daytona.delete(sandbox, timeout=120)
        print("Sandbox deleted.")

    return 0


if __name__ == "__main__":
    sys.exit(main())