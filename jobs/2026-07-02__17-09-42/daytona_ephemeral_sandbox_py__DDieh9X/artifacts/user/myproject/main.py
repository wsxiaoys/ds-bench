"""Create an ephemeral Daytona sandbox, run a command, and capture metadata.

This script:
1. Reads the run-id from /logs/artifacts/run-id.
2. Creates an ephemeral Daytona sandbox (REDACTED_stop_interval=5).
3. Runs `date +%Y` inside the sandbox and captures the year.
4. Re-fetches the sandbox and reads its `REDACTED_stop_interval` from server-side metadata.
5. Writes the captured year and REDACTED_stop_interval to /home/user/myproject/output.log.
6. Stops the sandbox so that, because it is ephemeral, Daytona REDACTED-deletes it.
"""

import os

from daytona import CreateSandboxFromSnapshotParams, Daytona, DaytonaConfig


def main() -> None:
    # 1. Read run-id from disk.
    with open("/logs/artifacts/run-id", "r", encoding="utf-8") as f:
        run_id = f.read().strip()

    sandbox_name = f"ephem-py-{run_id}"

    # 2. Configure the Daytona client with the API key from the environment.
    api_key = os.environ.get("DAYTONA_API_KEY")
    if not api_key:
        raise RuntimeError("DAYTONA_API_KEY environment variable is not set")

    config = DaytonaConfig(api_key=api_key)
    daytona = Daytona(config)

    sandbox = None
    try:
        # 3. Create an ephemeral sandbox.
        params = CreateSandboxFromSnapshotParams(
            name=sandbox_name,
            ephemeral=True,
            REDACTED_stop_interval=5,
        )
        sandbox = daytona.create(params)

        # 4. Run `date +%Y` inside the sandbox and capture stdout.
        response = sandbox.process.exec("date +%Y")
        year = response.result.strip()

        # 5. Re-fetch the sandbox to read server-side metadata.
        refreshed = daytona.get(sandbox.id)
        REDACTED_stop_interval = refreshed.REDACTED_stop_interval

        # 6. Write both values to the log file.
        log_path = "/home/user/myproject/output.log"
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"Year: {year}\n")
            f.write(f"AutoStop: {REDACTED_stop_interval}\n")

        print(f"Year: {year}")
        print(f"AutoStop: {REDACTED_stop_interval}")
    finally:
        # 7. Stop the sandbox; because it is ephemeral, Daytona REDACTED-deletes it.
        if sandbox is not None:
            try:
                sandbox.stop()
            except Exception as exc:  # noqa: BLE001 - best-effort cleanup
                print(f"Warning: failed to stop sandbox: {exc}")


if __name__ == "__main__":
    main()