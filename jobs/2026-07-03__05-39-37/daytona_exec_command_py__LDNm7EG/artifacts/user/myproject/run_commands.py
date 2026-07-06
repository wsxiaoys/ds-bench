#!/usr/bin/env python3
"""
Execute a sequence of shell commands inside a remote Daytona sandbox using the
Daytona Python SDK, collect their output, and persist a structured log locally.

The script:
  1. Reads the run-id from /logs/artifacts/run-id.
  2. Creates a new sandbox named exec-py-<run-id>.
  3. Runs `uname -a`, `pwd`, and `echo <run-id>` inside the sandbox.
  4. Writes the results to /home/user/myproject/output.log with prefixed lines.
  5. Always deletes the sandbox at the end (even on partial failure).
"""

import os
import sys

from daytona import Daytona, CreateSandboxFromSnapshotParams

RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_LOG_PATH = "/home/user/myproject/output.log"


def read_run_id(path: str) -> str:
    """Read and strip the run-id from the given file path."""
    with open(path, "r") as f:
        return f.read().strip()


def main() -> int:
    run_id = read_run_id(RUN_ID_PATH)
    sandbox_name = f"exec-py-{run_id}"

    # Authenticate using the DAYTONA_API_KEY environment variable.
    daytona = Daytona()

    sandbox = None
    results = []  # list of (prefix, output) tuples in execution order
    try:
        # Create a new sandbox with the derived name.
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = daytona.create(params)

        # Command 1: uname -a
        uname_resp = sandbox.process.exec("uname -a")
        results.append(("UNAME: ", uname_resp.result))

        # Command 2: pwd
        pwd_resp = sandbox.process.exec("pwd")
        results.append(("PWD: ", pwd_resp.result))

        # Command 3: echo <run-id>  (value from the local run-id file)
        echo_resp = sandbox.process.exec(f"echo {run_id}")
        results.append(("ECHO: ", echo_resp.result))

    finally:
        # Persist results to the local log file regardless of success/failure,
        # so partial output is still captured.
        with open(OUTPUT_LOG_PATH, "w") as f:
            for prefix, output in results:
                # Normalize trailing newlines from command output into a single line.
                f.write(f"{prefix}{output.rstrip()}\n")

        # Always clean up the sandbox so no orphaned sandboxes are left behind.
        if sandbox is not None:
            try:
                daytona.delete(sandbox)
            except Exception as cleanup_err:
                # Surface cleanup failures but do not mask the original error.
                print(f"Warning: failed to delete sandbox: {cleanup_err}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())