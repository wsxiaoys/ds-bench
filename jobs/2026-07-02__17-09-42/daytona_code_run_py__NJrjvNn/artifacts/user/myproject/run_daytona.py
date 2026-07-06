#!/usr/bin/env python3
"""
Run Python code in a Daytona sandbox.

This script:
  1. Creates a new Daytona sandbox whose name is `code-run-py-<run-id>` where
     `<run-id>` is read from `/logs/artifacts/run-id`.
  2. Runs a small Python snippet inside the sandbox via
     `sandbox.process.code_run(...)` that computes the sum of the integers
     from 1 through 100 and prints the integer result on stdout.
  3. Captures the printed value from the `code_run` response.
  4. Writes that value to `/home/user/myproject/output.log` using the exact
     format `Result: <value>` on a single line.
  5. Deletes the sandbox in a `finally` block so it is cleaned up whether or
     not earlier steps succeed.

Authentication is taken from the `DAYTONA_API_KEY` environment variable - no
credentials are hard-coded.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from daytona import Daytona, CreateSandboxBaseParams

# ---- Paths --------------------------------------------------------------- #

RUN_ID_PATH = Path("/logs/artifacts/run-id")
OUTPUT_LOG_PATH = Path("/home/user/myproject/output.log")

# The Python snippet that computes the sum of 1..100 and prints it. Using
# `sum(range(1, 101))` is the idiomatic way to express "sum of all integers
# from 1 through 100 (inclusive)".
PYTHON_SNIPPET = "print(sum(range(1, 101)))"


def read_run_id(path: Path) -> str:
    """Read the run id from disk, stripping trailing whitespace."""
    return path.read_text().strip()


def ensure_api_key() -> str:
    """Make sure `DAYTONA_API_KEY` is set; surface a clear error otherwise."""
    api_key = os.environ.get("DAYTONA_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DAYTONA_API_KEY environment variable is not set; cannot "
            "authenticate against the Daytona service."
        )
    return api_key


def write_output_log(value: str) -> None:
    """Persist the captured value to the output log file."""
    OUTPUT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_LOG_PATH.write_text(f"Result: {value}\n")


def main() -> int:
    # 1. Read inputs and authenticate.
    run_id = read_run_id(RUN_ID_PATH)
    sandbox_name = f"code-run-py-{run_id}"
    ensure_api_key()

    # The Daytona SDK reads DAYTONA_API_KEY (and optionally DAYTONA_API_URL /
    # DAYTONA_TARGET) from the environment. Instantiating with no config is
    # therefore the documented way to use env-var credentials.
    daytona = Daytona()
    sandbox = None

    try:
        # 2. Create the sandbox with the per-run name.
        sandbox = daytona.create(
            CreateSandboxBaseParams(name=sandbox_name),
            timeout=60,
        )

        # 3. Run the Python snippet inside the sandbox and capture stdout.
        response = sandbox.process.code_run(PYTHON_SNIPPET)

        captured = (response.result or "").strip()

        # 4. Persist the captured value locally. We fall back to the raw
        # `result` if the helper strip produces an empty string (it shouldn't,
        # but be defensive).
        if not captured:
            captured = (response.result or "").strip()
        write_output_log(captured)

        print(
            f"Sandbox {sandbox_name!r} executed snippet; result written to "
            f"{OUTPUT_LOG_PATH}"
        )
    finally:
        # 5. Always try to delete the sandbox, even if the code run or any
        # other step raised.
        if sandbox is not None:
            try:
                sandbox.delete()
            except Exception as exc:  # pragma: no cover - best-effort cleanup
                print(
                    f"Warning: failed to delete sandbox {sandbox_name!r}: "
                    f"{exc!r}",
                    file=sys.stderr,
                )

    return 0


if __name__ == "__main__":
    sys.exit(main())
