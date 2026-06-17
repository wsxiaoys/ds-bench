"""
Daytona File Upload and Download Demo
--------------------------------------
Flow:
  1. Provisions an ephemeral Daytona sandbox named  fs-py-<run-id>.
  2. Writes a local input file and uploads it into the sandbox.
  3. Runs a shell command inside the sandbox to upper-case the file.
  4. Downloads the transformed file back to the local filesystem.
  5. Appends "Upload+Download OK" to output.log.
  6. Deletes the sandbox (even if any step above fails).

Environment variables required:
  ZEALT_RUN_ID   – unique run identifier (used in sandbox name and input content)
  DAYTONA_API_KEY – Daytona SaaS authentication key
"""

import os
import sys

from daytona_sdk import Daytona, CreateSandboxFromSnapshotParams


def main() -> None:
    # ------------------------------------------------------------------ #
    # 1. Read runtime configuration from environment variables            #
    # ------------------------------------------------------------------ #
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("DAYTONA_API_KEY")
    if not api_key:
        print("ERROR: DAYTONA_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # ------------------------------------------------------------------ #
    # 2. Resolve project-local paths                                      #
    # ------------------------------------------------------------------ #
    project_dir  = "/home/user/myproject"
    input_path   = os.path.join(project_dir, "input.txt")
    output_path  = os.path.join(project_dir, "output.txt")
    log_path     = os.path.join(project_dir, "output.log")

    # Paths used inside the sandbox
    remote_input  = "/home/user/input.txt"
    remote_output = "/home/user/output.txt"

    # ------------------------------------------------------------------ #
    # 3. Create the local input file                                      #
    # ------------------------------------------------------------------ #
    input_content = f"Hello Daytona {run_id}"
    os.makedirs(project_dir, exist_ok=True)
    with open(input_path, "w") as fh:
        fh.write(input_content)
    print(f"[INFO] Created local input file: {input_path!r}  content={input_content!r}")

    # ------------------------------------------------------------------ #
    # 4. Initialise the Daytona client and provision the sandbox          #
    # ------------------------------------------------------------------ #
    sandbox_name = f"fs-py-{run_id}"
    daytona = Daytona()

    print(f"[INFO] Creating sandbox: {sandbox_name!r} …")
    sandbox = daytona.create(
        CreateSandboxFromSnapshotParams(name=sandbox_name)
    )
    print(f"[INFO] Sandbox ready  id={sandbox.id!r}")

    try:
        # -------------------------------------------------------------- #
        # 5. Upload the local input file to the sandbox                   #
        #    upload_file(src: str | bytes, dst: str) -> None              #
        # -------------------------------------------------------------- #
        print(f"[INFO] Uploading {input_path!r}  →  sandbox:{remote_input!r}")
        with open(input_path, "rb") as fh:
            file_bytes = fh.read()
        sandbox.fs.upload_file(file_bytes, remote_input)
        print("[INFO] Upload complete.")

        # -------------------------------------------------------------- #
        # 6. Transform the file inside the sandbox (upper-case via tr)    #
        #    exec(command) -> ExecuteResponse {exit_code, result, ...}    #
        # -------------------------------------------------------------- #
        transform_cmd = (
            f"tr '[:lower:]' '[:upper:]' < {remote_input} > {remote_output}"
        )
        print(f"[INFO] Running in sandbox: {transform_cmd!r}")
        resp = sandbox.process.exec(transform_cmd)
        if resp.exit_code != 0:
            raise RuntimeError(
                f"In-sandbox command failed (exit {resp.exit_code}): {resp.result}"
            )
        print("[INFO] Transformation complete.")

        # -------------------------------------------------------------- #
        # 7. Download the transformed file from the sandbox               #
        #    download_file(remote_path) -> bytes                          #
        # -------------------------------------------------------------- #
        print(f"[INFO] Downloading sandbox:{remote_output!r}  →  {output_path!r}")
        transformed_bytes: bytes = sandbox.fs.download_file(remote_output)
        with open(output_path, "wb") as fh:
            fh.write(transformed_bytes)
        print(f"[INFO] Download complete.  content={transformed_bytes.decode()!r}")

        # -------------------------------------------------------------- #
        # 8. Write confirmation to the log file                           #
        # -------------------------------------------------------------- #
        with open(log_path, "a") as fh:
            fh.write("Upload+Download OK\n")
        print(f"[INFO] Confirmation written to {log_path!r}")

    finally:
        # -------------------------------------------------------------- #
        # 9. Always delete the sandbox to avoid resource leaks            #
        # -------------------------------------------------------------- #
        print(f"[INFO] Deleting sandbox {sandbox_name!r} …")
        daytona.delete(sandbox)
        print("[INFO] Sandbox deleted.  Run complete.")


if __name__ == "__main__":
    main()
