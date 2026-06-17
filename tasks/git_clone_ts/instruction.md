# Clone a Git Repository in a Daytona Sandbox (TypeScript SDK)

## Background
Daytona provides a Toolbox `git` module accessible through its SDKs that lets you perform Git operations directly inside a sandbox without spawning a shell. You will use the Daytona TypeScript SDK to create a sandbox, clone a public repository inside it, inspect the resulting Git state, list the cloned files, write the collected information into a log file on the host, and then clean up.

## Requirements
- Write a TypeScript/Node.js program that uses the `@daytonaio/sdk` package to talk to the real Daytona SaaS at `https://app.daytona.io/api`.
- The program must perform these steps in order:
  1. Read `run-id` from the `ZEALT_RUN_ID` environment variable and create a sandbox whose name is `git-ts-${run-id}`.
  2. Use `sandbox.git.clone(...)` to clone `https://github.com/octocat/Spoon-Knife` into the absolute path `/home/daytona/spoon-knife` inside the sandbox.
  3. Call `sandbox.git.status(...)` against the cloned path and obtain the current branch name.
  4. Use `sandbox.process.executeCommand("ls /home/daytona/spoon-knife")` to list the files at the root of the cloned repository.
  5. Write the branch name and the file list to the log file on the host machine (the machine running the Node.js program), in the exact format described in the Acceptance Criteria.
  6. Delete the sandbox before exiting (regardless of success or failure of intermediate steps where possible).
- Use the real Daytona service; do not mock the SDK or any of its calls.
- Authenticate using the `DAYTONA_API_KEY` environment variable.

## Implementation Hints
- Install `@daytonaio/sdk` from npm and import the `Daytona` client.
- Configure the client with `apiKey: process.env.DAYTONA_API_KEY` and `serverUrl: 'https://app.daytona.io/api'`.
- Pass an absolute path (starting with `/`) to `git.clone` and `git.status` to control exactly where the repo lives.
- `sandbox.git.status(path)` returns an object whose `currentBranch` field holds the branch name.
- `sandbox.process.executeCommand(...)` returns an object whose `result` field contains the stdout text; split it on whitespace/newlines to get the file names.
- Build the file list value as the comma-separated names that appear in `ls` output (trimmed, ignoring empty entries); order does not matter.
- Use `try/finally` (or equivalent) so that the sandbox is deleted even when an error occurs.

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- The TypeScript program creates a sandbox named `git-ts-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The repository `https://github.com/octocat/Spoon-Knife` is cloned into `/home/daytona/spoon-knife` inside the sandbox using `sandbox.git.clone`.
- The log file `/home/user/myproject/output.log` contains exactly two informational lines, in any order:
  - A line of the form `Branch: <branch_name>` produced from `sandbox.git.status(...)`.
  - A line of the form `Files: <comma-separated names>` produced from `sandbox.process.executeCommand("ls /home/daytona/spoon-knife")`. The list must include every entry returned by `ls`, separated by `, ` (comma followed by a space) or `,` (comma only). Order is not significant.
- After the program finishes, the sandbox named `git-ts-${run-id}` no longer exists in the Daytona account.

