"""
Clone a Git repository in a Daytona Sandbox using the Python SDK.

Steps:
1. Read ZEALT_RUN_ID to name the sandbox.
2. Create a sandbox named git-py-<run-id>.
3. Clone https://github.com/octocat/Hello-World into /home/daytona/hello-world.
4. Call sandbox.git.status() and log the current branch.
5. Read the first line of the README and log it.
6. Delete the sandbox (always, even on failure).
"""

import os
import sys

from daytona import CreateSandboxFromSnapshotParams, Daytona

LOG_FILE = "/home/user/myproject/output.log"
REPO_URL = "https://github.com/octocat/Hello-World"
CLONE_PATH = "/home/daytona/hello-world"


def main():
    # Read run-id from environment
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    sandbox_name = f"git-py-{run_id}"
    print(f"Sandbox name: {sandbox_name}")

    daytona = Daytona()

    sandbox = None
    log_lines = []

    try:
        # Create the sandbox
        print(f"Creating sandbox '{sandbox_name}'...")
        sandbox = daytona.create(
            CreateSandboxFromSnapshotParams(name=sandbox_name),
            timeout=120,
        )
        print(f"Sandbox created: {sandbox.id}")

        # Clone the repository
        print(f"Cloning {REPO_URL} into {CLONE_PATH}...")
        sandbox.git.clone(
            url=REPO_URL,
            path=CLONE_PATH,
        )
        print("Clone complete.")

        # Get git status and extract branch name
        print("Fetching git status...")
        status = sandbox.git.status(path=CLONE_PATH)
        branch = status.current_branch
        print(f"Current branch: {branch}")
        log_lines.append(f"Branch: {branch}")

        # Read the README file
        print("Reading README file...")
        result = sandbox.process.exec(f"cat {CLONE_PATH}/README")
        readme_content = result.result if hasattr(result, "result") else str(result)
        first_line = readme_content.splitlines()[0] if readme_content else ""
        print(f"README first line: {first_line}")
        log_lines.append(f"README: {first_line}")

    finally:
        # Always delete the sandbox
        if sandbox is not None:
            print(f"Deleting sandbox '{sandbox_name}'...")
            daytona.delete(sandbox)
            print("Sandbox deleted.")

    # Write log file
    with open(LOG_FILE, "w") as f:
        for line in log_lines:
            f.write(line + "\n")

    print(f"\nLog written to {LOG_FILE}:")
    for line in log_lines:
        print(f"  {line}")


if __name__ == "__main__":
    main()
