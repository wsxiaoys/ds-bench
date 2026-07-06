#!/usr/bin/env python3
"""Daytona Python SDK smoke test.

Creates a sandbox, runs a small computation in it via process.code_run,
persists the result locally, and cleans up the sandbox.
"""

import os
import sys
from pathlib import Path

from daytona import Daytona, CreateSandboxFromSnapshotParams


def main() -> int:
    run_id_path = Path("/logs/artifacts/run-id")
    if not run_id_path.is_file():
        print(f"run-id file not found at {run_id_path}", file=sys.stderr)
        return 1

    run_id = run_id_path.read_text().strip()
    sandbox_name = f"code-run-py-{run_id}"

    output_path = Path("/home/user/myproject/output.log")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    daytona = Daytona()  # uses DAYTONA_API_KEY env var
    sandbox = None
    try:
        sandbox = daytona.create(
            CreateSandboxFromSnapshotParams(name=sandbox_name),
        )

        code = "print(sum(range(1, 101)))"
        response = sandbox.process.code_run(code)
        captured = response.result

        output_path.write_text(f"Result: {captured}\n")
    finally:
        if sandbox is not None:
            try:
                sandbox.delete()
            except Exception as exc:  # noqa: BLE001
                print(f"Warning: failed to delete sandbox: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
