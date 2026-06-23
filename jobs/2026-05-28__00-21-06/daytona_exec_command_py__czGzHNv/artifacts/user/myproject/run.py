"""
Execute a sequence of shell commands inside a Daytona sandbox, collect their
output, persist a structured log locally, and clean up the sandbox.
"""

import os
import sys

from daytona import CreateSandboxFromImageParams, Daytona


def main() -> None:
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    sandbox_name = f"exec-py-{run_id}"
    log_path = "/home/user/myproject/output.log"

    # Authenticate via DAYTONA_API_KEY (read automatically by the SDK).
    client = Daytona()

    params = CreateSandboxFromImageParams(
        name=sandbox_name,
        image="ubuntu:22.04",
    )

    sandbox = client.create(params)
    try:
        # 1. uname -a
        uname_resp = sandbox.process.exec("uname -a")
        uname_out = uname_resp.result.strip()

        # 2. pwd
        pwd_resp = sandbox.process.exec("pwd")
        pwd_out = pwd_resp.result.strip()

        # 3. echo the run-id value (expand on the local side so the sandbox
        #    does not need the variable to be defined inside it).
        echo_resp = sandbox.process.exec(f"echo {run_id}")
        echo_out = echo_resp.result.strip()

        # Persist results.
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w", encoding="utf-8") as fh:
            fh.write(f"UNAME: {uname_out}\n")
            fh.write(f"PWD: {pwd_out}\n")
            fh.write(f"ECHO: {echo_out}\n")

        print(f"Log written to {log_path}")
        print(f"UNAME: {uname_out}")
        print(f"PWD:   {pwd_out}")
        print(f"ECHO:  {echo_out}")

    finally:
        # Always delete the sandbox, even on partial failure.
        client.delete(sandbox)
        print(f"Sandbox '{sandbox_name}' deleted.")


if __name__ == "__main__":
    main()
