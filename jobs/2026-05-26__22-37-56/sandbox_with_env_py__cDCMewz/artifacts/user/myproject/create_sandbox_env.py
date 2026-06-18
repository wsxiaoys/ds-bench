import os
from pathlib import Path

from daytona import CreateSandboxFromSnapshotParams, Daytona


def main() -> None:
    run_id = os.getenv("ZEALT_RUN_ID")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID environment variable is not set.")

    sandbox_name = f"envvar-py-{run_id}"
    env_vars = {
        "MY_VAR": f"hello-{run_id}",
        "APP_MODE": "production",
    }
    log_path = Path("/home/user/myproject/output.log")

    daytona = Daytona()
    sandbox = None

    try:
        params = CreateSandboxFromSnapshotParams(
            name=sandbox_name,
            env_vars=env_vars,
        )
        sandbox = daytona.create(params)

        my_var_value = sandbox.process.exec("printenv MY_VAR").result.strip()
        app_mode_value = sandbox.process.exec("printenv APP_MODE").result.strip()

        log_path.write_text(
            f"MY_VAR: {my_var_value}\nAPP_MODE: {app_mode_value}\n",
            encoding="utf-8",
        )
    finally:
        if sandbox is not None:
            daytona.delete(sandbox)


if __name__ == "__main__":
    main()
