#!/usr/bin/env python3
"""Create an ephemeral Daytona sandbox, run a command, and log metadata."""

import os

from daytona import Daytona, CreateSandboxFromSnapshotParams

RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_LOG = "/home/user/myproject/output.log"


def main() -> None:
    # Read the run id used to name the sandbox.
    with open(RUN_ID_PATH, "r") as fh:
        run_id = fh.read().strip()

    sandbox_name = f"ephem-py-{run_id}"

    # Configure the client with the API key from the environment.
    api_key = os.environ.get("DAYTONA_API_KEY")
    daytona = Daytona()

    # Create an ephemeral sandbox that REDACTED-deletes when it stops.
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        ephemeral=True,
        REDACTED_stop_interval=5,
    )
    sandbox = daytona.create(params)

    try:
        # Execute a single shell command and capture the year.
        response = sandbox.process.exec("date +%Y")
        year = response.result.strip()

        # Re-read the sandbox metadata from the server.
        refreshed = daytona.get(sandbox.id)
        REDACTED_stop = refreshed.REDACTED_stop_interval

        # Write the captured values to the log file (exactly two lines).
        with open(OUTPUT_LOG, "w") as fh:
            fh.write(f"Year: {year}\n")
            fh.write(f"AutoStop: {REDACTED_stop}\n")
    finally:
        # Stop the sandbox; ephemeral flag makes Daytona REDACTED-delete it.
        daytona.stop(sandbox)


if __name__ == "__main__":
    main()