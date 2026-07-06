"""Create a Daytona Sandbox with custom environment variables.

This script:
1. Reads a run-id from /logs/artifacts/run-id.
2. Creates a Daytona sandbox named ``envvar-py-${run-id}`` with two custom
   environment variables: ``MY_VAR=hello-${run-id}`` and ``APP_MODE=production``.
3. Executes shell commands inside the sandbox to read those variables.
4. Writes the captured values to ``/home/user/myproject/output.log``.
5. Deletes the sandbox whether the run succeeds or fails.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from daytona import CreateSandboxFromSnapshotParams, Daytona


RUN_ID_FILE = Path("/logs/artifacts/run-id")
OUTPUT_FILE = Path("/home/user/myproject/output.log")


def read_run_id() -> str:
    """Read the run id from the artifacts directory."""
    run_id = RUN_ID_FILE.read_text().strip()
    if not run_id:
        raise RuntimeError(f"Run id file {RUN_ID_FILE} is empty")
    return run_id


def capture_env_value(sandbox, var_name: str) -> str:
    """Run a shell command inside the sandbox to print the env var's value."""
    response = sandbox.process.exec(f"echo \"${var_name}\"")
    return response.result.strip()


def write_outputs(values: dict[str, str]) -> None:
    """Write the captured env var values to the local log file."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"MY_VAR: {values['MY_VAR']}",
        f"APP_MODE: {values['APP_MODE']}",
    ]
    OUTPUT_FILE.write_text("\n".join(lines) + "\n")


def main() -> int:
    run_id = read_run_id()
    sandbox_name = f"envvar-py-{run_id}"

    daytona = Daytona()
    params = CreateSandboxFromSnapshotParams(
        name=sandbox_name,
        env_vars={
            "MY_VAR": f"hello-{run_id}",
            "APP_MODE": "production",
        },
    )

    sandbox = daytona.create(params)

    try:
        my_var = capture_env_value(sandbox, "MY_VAR")
        app_mode = capture_env_value(sandbox, "APP_MODE")
        write_outputs({"MY_VAR": my_var, "APP_MODE": app_mode})
        print(f"MY_VAR={my_var}")
        print(f"APP_MODE={app_mode}")
        return 0
    finally:
        try:
            sandbox.delete()
        except Exception as cleanup_error:  # pragma: no cover - best-effort cleanup
            print(f"Warning: failed to delete sandbox: {cleanup_error}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
