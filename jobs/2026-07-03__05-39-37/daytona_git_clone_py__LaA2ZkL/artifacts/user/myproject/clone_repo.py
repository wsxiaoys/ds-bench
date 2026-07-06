#!/usr/bin/env python3
"""Clone a public GitHub repository into a Daytona sandbox using the Python SDK.

Steps:
  1. Read the current run-id from /logs/artifacts/run-id.
  2. Create a Daytona sandbox named `git-py-${run-id}`.
  3. Clone https://github.com/octocat/Hello-World into /home/daytona/hello-world.
  4. Inspect the cloned repo with sandbox.git.status(...) and write the branch
     name to /home/user/myproject/output.log as `Branch: <name>`.
  5. Read the README from the cloned tree and append its first line to the
     output log with the prefix `README: `.
  6. Always delete the sandbox at the end, even if earlier steps fail.
"""

from __future__ import annotations

import os
import sys

from daytona import Daytona, CreateSandboxFromSnapshotParams

REPO_URL = "https://github.com/octocat/Hello-World"
CLONE_PATH = "/home/daytona/hello-world"
RUN_ID_FILE = "/logs/artifacts/run-id"
OUTPUT_LOG = "/home/user/myproject/output.log"


def read_run_id() -> str:
    with open(RUN_ID_FILE, "r", encoding="utf-8") as fh:
        return fh.read().strip()


def append_log(line: str) -> None:
    os.makedirs(os.path.dirname(OUTPUT_LOG), exist_ok=True)
    with open(OUTPUT_LOG, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    print(line)


def main() -> int:
    run_id = read_run_id()
    sandbox_name = f"git-py-{run_id}"
    print(f"Run ID: {run_id}")
    print(f"Sandbox name: {sandbox_name}")

    # Authenticate using the DAYTONA_API_KEY environment variable.
    daytona = Daytona()

    sandbox = None
    try:
        # Start from a clean output log.
        if os.path.exists(OUTPUT_LOG):
            os.remove(OUTPUT_LOG)

        # Create the sandbox.
        params = CreateSandboxFromSnapshotParams(name=sandbox_name)
        sandbox = daytona.create(params, timeout=120)
        print(f"Created sandbox {sandbox.id} (name={sandbox_name})")

        # Clone the public repository into the sandbox.
        sandbox.git.clone(url=REPO_URL, path=CLONE_PATH)
        print(f"Cloned {REPO_URL} -> {CLONE_PATH}")

        # Inspect the repository state.
        status = sandbox.git.status(path=CLONE_PATH)
        branch = status.current_branch
        print(f"Current branch: {branch}")
        append_log(f"Branch: {branch}")

        # Read the README from the cloned repository.
        readme_first_line = ""
        try:
            readme_bytes = sandbox.fs.download_file(f"{CLONE_PATH}/README")
            if readme_bytes:
                readme_text = readme_bytes.decode("utf-8", errors="replace")
                readme_first_line = readme_text.splitlines()[0] if readme_text.strip() else ""
        except Exception as exc:  # noqa: BLE001
            print(f"download_file failed ({exc!r}); falling back to process.exec")
            resp = sandbox.process.exec(f"cat {CLONE_PATH}/README")
            if getattr(resp, "exit_code", 1) == 0 and getattr(resp, "result", None):
                readme_first_line = str(resp.result).splitlines()[0] if resp.result.strip() else ""

        print(f"README first line: {readme_first_line!r}")
        append_log(f"README: {readme_first_line}")

        print("All steps completed successfully.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc!r}", file=sys.stderr)
        return 1
    finally:
        # Always clean up the sandbox, even on failure.
        if sandbox is not None:
            try:
                daytona.delete(sandbox, timeout=120)
                print(f"Deleted sandbox {sandbox_name}")
            except Exception as exc:  # noqa: BLE001
                print(f"WARNING: failed to delete sandbox: {exc!r}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())