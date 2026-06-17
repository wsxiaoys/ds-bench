# Clone a Git Repository in a Daytona Sandbox with the Python SDK

## Background
Daytona provides a managed cloud sandbox environment with a built-in Git module accessible through the Daytona Python SDK. In this task, you will programmatically create a sandbox, clone a public GitHub repository into it, inspect the Git repository state, read a file from the cloned tree, and clean up the sandbox.

## Requirements
- Use the Daytona Python SDK (`daytona`) to interact with Daytona Cloud.
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable and use it to name the sandbox.
- Create a sandbox with the base name `git-py` suffixed with `-${run-id}` (i.e. `git-py-${ZEALT_RUN_ID}`).
- Inside the sandbox, clone the public repository `https://github.com/octocat/Hello-World` into the directory `/home/daytona/hello-world` using `sandbox.git.clone(...)`.
- Call `sandbox.git.status(...)` on the cloned repository and write the current branch name to the task log file in the format `Branch: <name>`.
- Read the `README` file from the cloned repository inside the sandbox (using `sandbox.fs.download_file` or `sandbox.process.exec("cat ...")`) and append the first line of the file to the log file with the prefix `README: `.
- After all work is done, delete the sandbox.

## Implementation Hints
- Authenticate the Daytona client using the `DAYTONA_API_KEY` environment variable.
- Use the SDK's git module (`sandbox.git.clone`, `sandbox.git.status`) for repository operations rather than shelling out to `git`.
- The Hello-World repository's default branch is `master` and the README contains a well-known greeting line.
- Use `sandbox.fs.download_file(path)` to retrieve the README bytes, or `sandbox.process.exec("cat /home/daytona/hello-world/README")` to print and capture it.
- Ensure the sandbox is always deleted at the end, even if earlier steps fail.

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- The sandbox name must be `git-py-${run-id}` where `run-id` comes from the `ZEALT_RUN_ID` environment variable.
- The clone target path inside the sandbox is `/home/daytona/hello-world` and is created via `sandbox.git.clone`.
- After execution, the log file must contain a line in the format: `Branch: <name>` (the current branch reported by `sandbox.git.status`).
- After execution, the log file must contain a line in the format: `README: <first line of README>` (the first line of the cloned repository's README file).
- The sandbox created by the task must be deleted by the time the task finishes.

