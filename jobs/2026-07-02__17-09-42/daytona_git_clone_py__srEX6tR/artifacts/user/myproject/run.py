#!/usr/bin/env python3
"""Clone a public Git repository into a Daytona sandbox and inspect it."""

import os
import sys

from daytona import Daytona, CreateSandboxBaseParams


def main() -> int:
    # Read run-id and build sandbox name
    with open("/logs/artifacts/run-id", "r") as fh:
        run_id = fh.read().strip()
    sandbox_name = f"git-py-{run_id}"
    print(f"[run-id] {run_id}")
    print(f"[sandbox name] {sandbox_name}")

    output_log_path = "/home/user/myproject/output.log"
    # Ensure the local output directory exists
    os.makedirs(os.path.dirname(output_log_path), exist_ok=True)

    daytona = Daytona()  # uses DAYTONA_API_KEY from env
    sandbox = None
    log_lines: list[str] = []

    try:
        # Create sandbox with explicit name
        sandbox = daytona.create(
            CreateSandboxBaseParams(name=sandbox_name),
            timeout=120,
        )
        print(f"[created] {sandbox_name}")

        # Clone the public Hello-World repo using the SDK git module
        clone_path = "/home/daytona/hello-world"
        sandbox.git.clone(
            url="https://github.com/octocat/Hello-World",
            path=clone_path,
        )
        print(f"[cloned] {clone_path}")

        # Get repository status and capture current branch
        status = sandbox.git.status(clone_path)
        branch = status.current_branch
        print(f"[branch] {branch}")
        log_lines.append(f"Branch: {branch}")

        # Download the README from the sandbox
        readme_bytes = sandbox.fs.download_file(f"{clone_path}/README")
        if readme_bytes is None:
            raise RuntimeError("README download returned no data")
        readme_text = readme_bytes.decode("utf-8")
        first_line = readme_text.splitlines()[0] if readme_text else ""
        print(f"[README first line] {first_line}")
        log_lines.append(f"README: {first_line}")

        # Persist the log file locally
        with open(output_log_path, "w") as fh:
            fh.write("\n".join(log_lines) + "\n")
        print(f"[wrote] {output_log_path}")

        return 0
    except Exception:
        # Best-effort: still try to persist any partial info
        if log_lines:
            try:
                with open(output_log_path, "w") as fh:
                    fh.write("\n".join(log_lines) + "\n")
            except Exception:
                pass
        raise
    finally:
        # Always delete the sandbox
        if sandbox is not None:
            try:
                daytona.delete(sandbox, timeout=60)
                print(f"[deleted] {sandbox_name}")
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] failed to delete sandbox: {exc}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())