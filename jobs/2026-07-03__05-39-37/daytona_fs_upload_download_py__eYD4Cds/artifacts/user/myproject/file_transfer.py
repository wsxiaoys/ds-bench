#!/usr/bin/env python3
"""Daytona file upload/download demonstration.

Provisions an ephemeral Daytona sandbox, uploads a local input file,
transforms its contents to uppercase inside the sandbox, downloads the
result back to the local filesystem, and cleans up the sandbox.
"""

import os
import sys

from daytona import Daytona, CreateSandboxFromSnapshotParams

# ---------------------------------------------------------------------------
# Paths and run-id
# ---------------------------------------------------------------------------
RUN_ID_PATH = "/logs/artifacts/run-id"
PROJECT_DIR = "/home/user/myproject"
LOCAL_INPUT = os.path.join(PROJECT_DIR, "input.txt")
LOCAL_OUTPUT = os.path.join(PROJECT_DIR, "output.txt")
LOCAL_LOG = os.path.join(PROJECT_DIR, "output.log")

# Remote paths inside the sandbox (relative to the sandbox working dir)
REMOTE_INPUT = "input.txt"
REMOTE_OUTPUT = "output.txt"


def read_run_id() -> str:
    with open(RUN_ID_PATH, "r") as fh:
        return fh.read().strip()


def main() -> int:
    run_id = read_run_id()
    sandbox_name = f"fs-py-{run_id}"
    input_content = f"Hello Daytona {run_id}"

    # Make sure the project directory exists and write the local input file.
    os.makedirs(PROJECT_DIR, exist_ok=True)
    with open(LOCAL_INPUT, "w") as fh:
        fh.write(input_content)

    daytona = Daytona()
    sandbox = None
    try:
        # Provision the sandbox with a label/name derived from run-id.
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = daytona.create(params)
        print(f"[info] created sandbox {sandbox_name}")

        work_dir = sandbox.get_work_dir()
        remote_input_path = f"{work_dir}/{REMOTE_INPUT}"
        remote_output_path = f"{work_dir}/{REMOTE_OUTPUT}"

        # Upload the local input file into the sandbox.
        with open(LOCAL_INPUT, "rb") as fh:
            content = fh.read()
        sandbox.fs.upload_file(content, remote_input_path)
        print(f"[info] uploaded {LOCAL_INPUT} -> {remote_input_path}")

        # Transform the file in-sandbox: lowercase -> uppercase.
        cmd = f"tr '[:lower:]' '[:upper:]' < {remote_input_path} > {remote_output_path}"
        result = sandbox.process.exec(cmd, cwd=work_dir)
        if result.exit_code != 0:
            raise RuntimeError(
                f"in-sandbox transform failed (exit {result.exit_code}): {result.result}"
            )
        print(f"[info] transformed file in-sandbox -> {remote_output_path}")

        # Download the transformed file back to the local filesystem.
        data = sandbox.fs.download_file(remote_output_path)
        if data is None:
            raise RuntimeError("download_file returned no data")
        with open(LOCAL_OUTPUT, "wb") as fh:
            fh.write(data)
        print(f"[info] downloaded {remote_output_path} -> {LOCAL_OUTPUT}")

        # Confirm success in the log file.
        with open(LOCAL_LOG, "w") as fh:
            fh.write("Upload+Download OK\n")
        print("[info] wrote confirmation to output.log")

        # Echo the result for visibility.
        print(f"[result] output.txt contents: {data.decode('utf-8').strip()}")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"[error] {exc}", file=sys.stderr)
        return 1
    finally:
        # Always clean up the sandbox so resources do not leak.
        if sandbox is not None:
            try:
                daytona.delete(sandbox)
                print(f"[info] deleted sandbox {sandbox_name}")
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] failed to delete sandbox: {exc}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())