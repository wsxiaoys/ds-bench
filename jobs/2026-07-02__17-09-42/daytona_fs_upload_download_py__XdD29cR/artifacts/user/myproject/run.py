"""Daytona file upload/download demonstration using the Python SDK.

Flow:
1. Read run-id from /logs/artifacts/run-id.
2. Provision an ephemeral Daytona sandbox whose name is ``fs-py-${run-id}``.
3. Create a local input file and upload it to the sandbox via the SDK FS API.
4. Run a shell command (``tr``) inside the sandbox to uppercase the file.
5. Download the transformed file back to the local filesystem.
6. Delete the sandbox (always, even on error) and write a confirmation log.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from daytona import (
    CreateSandboxFromSnapshotParams,
    Daytona,
)


RUN_ID_FILE = Path("/logs/artifacts/run-id")
PROJECT_DIR = Path("/home/user/myproject")
LOCAL_INPUT = PROJECT_DIR / "input.txt"
LOCAL_OUTPUT = PROJECT_DIR / "output.txt"
LOCAL_LOG = PROJECT_DIR / "output.log"

REMOTE_INPUT = "/tmp/input.txt"
REMOTE_OUTPUT = "/tmp/output.txt"


def read_run_id() -> str:
    """Read the run-id from the artifact file, trimming any trailing whitespace."""
    if not RUN_ID_FILE.is_file():
        raise FileNotFoundError(f"Run-id file not found at {RUN_ID_FILE}")
    return RUN_ID_FILE.read_text().strip()


def main() -> int:
    run_id = read_run_id()
    sandbox_name = f"fs-py-{run_id}"

    # Ensure the project directory exists locally.
    PROJECT_DIR.mkdir(parents=True, exist_ok=True)

    # Create the local input file with the exact required content.
    input_content = f"Hello Daytona {run_id}"
    LOCAL_INPUT.write_text(input_content)
    print(f"[local] wrote {LOCAL_INPUT} ({len(input_content)} bytes)")

    daytona = Daytona()
    sandbox = None

    try:
        # Provision an ephemeral sandbox with the derived name/label.
        print(f"[daytona] creating sandbox {sandbox_name!r} ...")
        sandbox = daytona.create(
            CreateSandboxFromSnapshotParams(
                name=sandbox_name,
                ephemeral=True,
            )
        )
        print(f"[daytona] sandbox created: id={sandbox.id}")

        # Upload the local input file into the sandbox.
        print(f"[fs] uploading {LOCAL_INPUT} -> sandbox:{REMOTE_INPUT}")
        sandbox.fs.upload_file(input_content, REMOTE_INPUT)

        # Transform the file inside the sandbox with `tr`.
        cmd = f"tr '[:lower:]' '[:upper:]' < {REMOTE_INPUT} > {REMOTE_OUTPUT}"
        print(f"[exec] running: {cmd}")
        response = sandbox.process.exec(cmd)
        if response.exit_code != 0:
            raise RuntimeError(
                f"in-sandbox command failed (exit {response.exit_code}): "
                f"{response.result}"
            )

        # Download the transformed file back to the local filesystem.
        print(f"[fs] downloading sandbox:{REMOTE_OUTPUT} -> {LOCAL_OUTPUT}")
        downloaded = sandbox.fs.download_file(REMOTE_OUTPUT)
        if downloaded is None:
            raise RuntimeError(f"download_file returned None for {REMOTE_OUTPUT}")
        LOCAL_OUTPUT.write_bytes(downloaded)
        print(f"[local] wrote {LOCAL_OUTPUT} ({len(downloaded)} bytes)")

        # Confirm the transformed contents look right.
        transformed_text = LOCAL_OUTPUT.read_text().strip()
        print(f"[verify] output content: {transformed_text!r}")

        # Write the success confirmation log line.
        LOCAL_LOG.write_text("Upload+Download OK\n")
        print(f"[local] wrote {LOCAL_LOG}")
        print("Upload+Download OK")
        return 0

    except Exception as exc:  # noqa: BLE001 - surface any failure clearly
        print(f"[error] {exc}", file=sys.stderr)
        return 1

    finally:
        # Always delete the sandbox so resources don't leak.
        if sandbox is not None:
            try:
                print(f"[daytona] deleting sandbox {sandbox_name!r} ...")
                sandbox.delete()
                print("[daytona] sandbox deleted")
            except Exception as cleanup_exc:  # noqa: BLE001
                print(
                    f"[warn] failed to delete sandbox: {cleanup_exc}",
                    file=sys.stderr,
                )


if __name__ == "__main__":
    sys.exit(main())