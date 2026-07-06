#!/usr/bin/env python3
"""Create a Daytona sandbox, run a computation via process.code_run,
persist the result locally, and clean up the sandbox."""

import os
import sys
from daytona import Daytona, CreateSandboxFromSnapshotParams

RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_PATH = "/home/user/myproject/output.log"


def read_run_id(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read().strip()


def main() -> int:
    # The SDK reads DAYTONA_API_KEY from the environment REDACTEDmatically.
    if not os.environ.get("DAYTONA_API_KEY"):
        print("DAYTONA_API_KEY environment variable is not set", file=sys.stderr)
        return 1

    run_id = read_run_id(RUN_ID_PATH)
    sandbox_name = f"code-run-py-{run_id}"

    # Python snippet that sums 1..100 inclusive and prints the integer result.
    code = "print(sum(range(1, 101)))"

    daytona = Daytona()
    sandbox = None
    captured_value = None
    try:
        sandbox = daytona.create(
            CreateSandboxFromSnapshotParams(name=sandbox_name)
        )
        response = sandbox.process.code_run(code)

        # `result` holds the captured stdout of the executed snippet.
        captured_value = (response.result or "").strip()
        if not captured_value:
            raise RuntimeError(
                f"code_run returned empty stdout (exit_code={response.exit_code})"
            )
    finally:
        # Always clean up the sandbox, even if earlier steps fail.
        if sandbox is not None:
            try:
                daytona.delete(sandbox)
            except Exception as exc:  # noqa: BLE001 - cleanup must not mask errors
                print(f"Warning: failed to delete sandbox: {exc}", file=sys.stderr)

    # Persist the captured value locally in the required format.
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(f"Result: {captured_value}\n")

    print(f"Wrote '{OUTPUT_PATH}': Result: {captured_value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())