import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID", "default")

    sandbox_name = f"envvar-py-{run_id}"
    my_var_value = f"hello-{run_id}"

    client = Daytona()

    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        env_vars={
            "MY_VAR": my_var_value,
            "APP_MODE": "production",
        },
    )

    sandbox = client.create(params)

    try:
        my_var_result = sandbox.process.exec("echo $MY_VAR")
        my_var = my_var_result.result.strip()

        app_mode_result = sandbox.process.exec("echo $APP_MODE")
        app_mode = app_mode_result.result.strip()

        log_path = "/home/user/myproject/output.log"
        with open(log_path, "w") as f:
            f.write(f"MY_VAR: {my_var}\n")
            f.write(f"APP_MODE: {app_mode}\n")

        print(f"MY_VAR: {my_var}")
        print(f"APP_MODE: {app_mode}")
        print(f"Log written to {log_path}")
    finally:
        client.delete(sandbox)
        print(f"Sandbox '{sandbox_name}' deleted.")

if __name__ == "__main__":
    main()
