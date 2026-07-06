# Clone a Git Repository in a Daytona Sandbox with the Python SDK

## Background
Daytona provides a managed cloud sandbox environment with a built-in Git module accessible through the Daytona Python SDK. In this task, you will programmatically create a sandbox, clone a public GitHub repository into it, inspect the Git repository state, read a file from the cloned tree, and clean up the sandbox.

## Requirements
- Use the Daytona Python SDK (`daytona`) to interact with Daytona Cloud.
- Read the current `run-id` from `/logs/artifacts/run-id` and use it to name the sandbox.
- Create a sandbox with the name `git-py-${run-id}` (where `run-id` is read from `/logs/artifacts/run-id`).
- Inside the sandbox, clone the public repository `https://github.com/octocat/Hello-World` into the directory `/home/daytona/hello-world` using `sandbox.git.clone(...)`.
- Call `sandbox.git.status(...)` on the cloned repository and write the current branch name to `/home/user/myproject/output.log` in the format `Branch: <name>`.
- Read the `README` file from the cloned repository inside the sandbox (using `sandbox.fs.download_file` or `sandbox.process.exec("cat ...")`) and append the first line of the file to `/home/user/myproject/output.log` with the prefix `README: `.
- After all work is done, delete the sandbox.

## Implementation Hints
- Authenticate the Daytona client using the `DAYTONA_API_KEY` environment variable.
- Use the SDK's git module (`sandbox.git.clone`, `sandbox.git.status`) for repository operations rather than shelling out to `git`.
- The Hello-World repository's default branch is `master` and the README contains a well-known greeting line.
- Use `sandbox.fs.download_file(path)` to retrieve the README bytes, or `sandbox.process.exec("cat /home/daytona/hello-world/README")` to print and capture it.
- Write the output to `/home/user/myproject/output.log`.
- Ensure the sandbox is always deleted at the end, even if earlier steps fail.

