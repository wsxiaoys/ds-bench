#!/usr/bin/env python3
"""Execute shell commands in a remote Daytona sandbox and log the results.

This script:
  * Reads a run-id from /logs/artifacts/run-id.
  * Provisions a fresh Daytona sandbox named ``exec-py-<run-id>``.
  * Runs ``uname -a``, ``pwd`` and ``echo <run-id>`` inside that sandbox
    via ``sandbox.process.exec(...)``.
  * Persists one prefixed line per command to /home/user/myproject/output.log.
  * Always deletes the sandbox (even on partial failure) so no orphans remain.
"""

from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path

from daytona import CreateSandboxFromSnapshotParams, Daytona

RUN_ID_PATH = Path("/logs/artifacts/run-id")
OUTPUT_LOG_PATH = Path("/home/user/myproject/output.log")


def read_run_id(path: Path) -> str:
    """Read and return the trimmed run-id from ``path``."""
    if not path.is_file():
        raise FileNotFoundError(f"Run-id file not found at {path}")
    run_id = path.read_text(encoding="utf-8").strip()
    if not run_id:
        raise ValueError(f"Run-id file at {path} is empty")
    return run_id


def append_log(path: Path, line: str) -> None:
    """Append a single line to ``path`` (creating parent dirs as needed)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(line.rstrip("\n") + "\n")


def main() -> int:
    # 1. Read the run-id from disk.
    run_id = read_run_id(RUN_ID_PATH)
    sandbox_name = f"exec-py-{run_id}"

    # Truncate any previous log so the file reflects this run only.
    OUTPUT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_LOG_PATH.write_text("", encoding="utf-8")

    # 2. Authenticate against the Daytona SaaS endpoint via DAYTONA_API_KEY.
    daytona = Daytona()

    sandbox = None
    try:
        # 3. Create a fresh sandbox with the requested name.
        sandbox = daytona.create(
            CreateSandboxFromSnapshotParams(name=sandbox_name)
        )

        # 4. Execute the three commands and persist their stdout.
        commands = [
            ("UNAME: ", "uname -a"),
            ("PWD: ", "pwd"),
            ("ECHO: ", f"echo {run_id}"),
        ]

        for prefix, command in commands:
            response = sandbox.process.exec(command)
            stdout = response.result if response is not None else ""
            append_log(OUTPUT_LOG_PATH, f"{prefix}{stdout}")
    except Exception as exc:  # noqa: BLE001 - log and re-raise after cleanup
        # Make the failure visible in the log so consumers can see what went wrong.
        append_log(OUTPUT_LOG_PATH, f"ERROR: {exc!r}")
        traceback.print_exc()
        raise
    finally:
        # 5. Always clean up the sandbox, even on partial failure.
        if sandbox is not None:
            try:
                daytona.delete(sandbox)
            except Exception as cleanup_exc:  # noqa: BLE001
                print(
                    f"Failed to delete sandbox {sandbox_name!r}: {cleanup_exc!r}",
                    file=sys.stderr,
                )

    return 0


if __name__ == "__main__":
    sys.exit(main())
