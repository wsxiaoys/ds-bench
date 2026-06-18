import os
from pathlib import Path

from daytona import CreateSandboxFromSnapshotParams, Daytona


LOG_PATH = Path("/home/user/myproject/output.log")


def main() -> None:
    api_key = os.environ["DAYTONA_API_KEY"]
    run_id = os.environ["ZEALT_RUN_ID"]
    sandbox_name = f"ephem-py-{run_id}"

    daytona = Daytona(api_key=api_key)
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        snapshot_id="default",
        ephemeral=True,
        auto_stop_interval=5,
    )

    sandbox = daytona.create_sandbox_from_snapshot(params)
    try:
        exec_result = sandbox.process.exec("date +%Y")
        year = exec_result.result.strip()

        refreshed_sandbox = daytona.get(sandbox.id)
        auto_stop_interval = refreshed_sandbox.auto_stop_interval

        LOG_PATH.write_text(
            f"Year: {year}\nAutoStop: {auto_stop_interval}\n",
            encoding="utf-8",
        )
    finally:
        sandbox.stop()


if __name__ == "__main__":
    main()
