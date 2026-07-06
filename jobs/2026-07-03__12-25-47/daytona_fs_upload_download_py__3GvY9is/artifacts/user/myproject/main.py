import os
import sys

from daytona import Daytona, CreateSandboxFromSnapshotParams


def main() -> int:
    run_id_path = "/logs/artifacts/run-id"
    project_dir = "/home/user/myproject"
    input_path = os.path.join(project_dir, "input.txt")
    output_path = os.path.join(project_dir, "output.txt")
    log_path = os.path.join(project_dir, "output.log")

    # Read the run-id
    with open(run_id_path, "r", encoding="utf-8") as f:
        run_id = f.read().strip()

    sandbox_name = f"fs-py-{run_id}"
    input_content = f"Hello Daytona {run_id}\n"

    # Ensure the project directory exists.
    os.makedirs(project_dir, exist_ok=True)

    # Write the local input file.
    with open(input_path, "w", encoding="utf-8") as f:
        f.write(input_content)

    # Sandbox-side paths.
    remote_input = "/home/daytona/input.txt"
    remote_output = "/home/daytona/output.txt"

    daytona_client = Daytona()
    sandbox = None
    try:
        # Provision an ephemeral sandbox labeled with the run-id.
        sandbox = daytona_client.create(
            CreateSandboxFromSnapshotParams(
                name=sandbox_name,
                ephemeral=True,
            ),
            timeout=120,
        )

        # Upload the local input file to the sandbox.
        sandbox.fs.upload_file(input_content.encode("utf-8"), remote_input)

        # Transform the file: convert contents to uppercase.
        exec_response = sandbox.process.exec(
            f"tr '[:lower:]' '[:upper:]' < {remote_input} > {remote_output}"
        )
        if exec_response.exit_code != 0:
            raise RuntimeError(
                f"Shell transformation failed: exit_code={exec_response.exit_code} result={exec_response.result!r}"
            )

        # Download the transformed file back to the local filesystem.
        downloaded = sandbox.fs.download_file(remote_output)
        if downloaded is None:
            raise RuntimeError("Downloaded file is empty")
        with open(output_path, "wb") as f:
            f.write(downloaded)

        # Write the confirmation log line.
        with open(log_path, "w", encoding="utf-8") as f:
            f.write("Upload+Download OK\n")

        print("Upload+Download OK")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    finally:
        if sandbox is not None:
            try:
                sandbox.delete(timeout=60)
            except Exception as exc:  # noqa: BLE001
                print(f"Warning: failed to delete sandbox: {exc}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
