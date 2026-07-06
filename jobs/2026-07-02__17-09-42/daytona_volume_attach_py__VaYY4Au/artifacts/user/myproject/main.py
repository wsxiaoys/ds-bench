#!/usr/bin/env python3
"""Mount a Daytona volume inside a sandbox, write/read a marker, and log results."""
import os
import sys
import traceback

from daytona import (
    CreateSandboxFromSnapshotParams,
    Daytona,
    VolumeMount,
)

RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_LOG_PATH = "/home/user/myproject/output.log"


def fail(reason: str) -> None:
    """Write an error line to the output log and exit non-zero."""
    with open(OUTPUT_LOG_PATH, "w", encoding="utf-8") as f:
        f.write(f"Error: {reason}\n")
    print(f"Error: {reason}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    # 1. Read the run-id
    try:
        with open(RUN_ID_PATH, "r", encoding="utf-8") as f:
            run_id = f.read().strip()
    except Exception as exc:
        fail(f"could not read run-id: {exc}")
    if not run_id:
        fail("run-id file is empty")
    print(f"run-id = {run_id}")

    volume_name = f"vol-{run_id}"
    sandbox_name = f"vol-py-{run_id}"
    marker_text = f"persistent {run_id}"
    marker_path = "/data/marker.txt"

    # 2. Sanity-check the DAYTONA_API_KEY
    if not os.environ.get("DAYTONA_API_KEY"):
        fail("DAYTONA_API_KEY environment variable is not set")

    sandbox = None  # declared up-front so cleanup runs even on failure

    try:
        # 3. Initialize the Daytona client
        daytona = Daytona()

        # 4. Get or create the volume
        volume = daytona.volume.get(volume_name, create=True)
        print(f"Got volume {volume.name} (id={volume.id}, state={getattr(volume, 'state', 'unknown')})")

        # 5. Create the sandbox with the volume mounted at /data
        params = CreateSandboxFromSnapshotParams(
            name=sandbox_name,
            language="python",
            volumes=[VolumeMount(volume_id=volume.id, mount_path="/data")],
        )
        sandbox = daytona.create(params, timeout=180)
        print(f"Created sandbox {sandbox.name} (id={sandbox.id})")

        # 6. Write the marker file to the mounted volume
        write_resp = sandbox.process.exec(
            f"mkdir -p /data && printf %s {marker_text!r} > {marker_path}"
        )
        if write_resp.exit_code != 0:
            fail(f"failed to write marker: {write_resp.output}")
        print("Marker written")

        # 7. Read it back via cat
        read_resp = sandbox.process.exec(f"cat {marker_path}")
        if read_resp.exit_code != 0:
            fail(f"failed to read marker: {read_resp.output}")
        marker_read = (read_resp.output or "").strip()
        print(f"Marker read back: {marker_read!r}")

        # 8. List volumes for the count
        volumes = daytona.volume.list()
        volume_count = len(volumes)
        print(f"VolumeCount: {volume_count}")

        # 9. Write the required log file (exactly two lines)
        with open(OUTPUT_LOG_PATH, "w", encoding="utf-8") as f:
            f.write(f"Marker: {marker_read}\n")
            f.write(f"VolumeCount: {volume_count}\n")
        print(f"Wrote {OUTPUT_LOG_PATH}")

    except Exception as exc:
        traceback.print_exc()
        fail(f"unexpected error: {exc}")
    finally:
        # 10. Clean up the sandbox (best-effort)
        if sandbox is not None:
            try:
                daytona.delete(sandbox, timeout=60)
                print(f"Deleted sandbox {sandbox.name}")
            except Exception as cleanup_exc:
                print(f"Warning: failed to delete sandbox: {cleanup_exc}")


if __name__ == "__main__":
    main()
