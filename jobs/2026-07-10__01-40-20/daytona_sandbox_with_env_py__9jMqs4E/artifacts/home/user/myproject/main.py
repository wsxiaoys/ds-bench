#!/usr/bin/env python3
"""Create a Daytona sandbox with custom environment variables and verify them."""

from daytona import Daytona, CreateSandboxFromSnapshotParams

RUN_ID_FILE = "/logs/artifacts/run-id"
OUTPUT_LOG = "/home/user/myproject/output.log"


def main() -> None:
    # 1. Read the run-id from the artifacts file.
    with open(RUN_ID_FILE, "r") as f:
        run_id = f.read().strip()

    sandbox_name = f"envvar-py-{run_id}"
    env_vars = {
        "MY_VAR": f"hello-{run_id}",
        "APP_MODE": "production",
    }

    daytona = Daytona()
    sandbox = None

    try:
        # 2. Create the sandbox with a custom name and environment variables.
        params = CreateSandboxFromSnapshotParams(
            name=sandbox_name,
            env_vars=env_vars,
        )
        sandbox = daytona.create(params)

        # 3. Execute shell commands inside the sandbox to read the env vars.
        my_var_resp = sandbox.process.exec("echo $MY_VAR")
        app_mode_resp = sandbox.process.exec("echo $APP_MODE")

        my_var_value = my_var_resp.result.strip()
        app_mode_value = app_mode_resp.result.strip()

        # 4. Record the captured values in the local log file.
        with open(OUTPUT_LOG, "w") as f:
            f.write(f"MY_VAR: {my_var_value}\n")
            f.write(f"APP_MODE: {app_mode_value}\n")

        print(f"MY_VAR: {my_var_value}")
        print(f"APP_MODE: {app_mode_value}")
    finally:
        # 5. Delete the sandbox at the end, whether the run succeeds or fails.
        if sandbox is not None:
            daytona.delete(sandbox)


if __name__ == "__main__":
    main()