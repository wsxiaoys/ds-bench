# Create a Daytona Sandbox with Custom Environment Variables (Python SDK)

## Background
Daytona is a platform that provides secure, isolated sandboxes for running code. The Python SDK lets you programmatically create sandboxes with custom environment variables and execute commands inside them. This is essential for running code with configuration-specific settings (e.g., production mode flags or per-run secrets).

In this task, you will use the Daytona Python SDK to create a sandbox configured with custom environment variables, then verify that those variables are available inside the sandbox by executing shell commands.

## Requirements
- Write a Python script that uses the Daytona Python SDK to:
  1. Create a sandbox with two custom environment variables: `MY_VAR` and `APP_MODE`.
  2. Execute shell commands inside the sandbox to read those environment variables.
  3. Record the captured values in a local log file on the host.
  4. Delete the sandbox at the end (whether the run succeeds or fails).
- The sandbox name and the value of `MY_VAR` must both incorporate the current `run-id` to avoid collisions when the task runs concurrently.

## Implementation Hints
- Read the `run-id` from the `ZEALT_RUN_ID` environment variable before creating the sandbox.
- The Daytona Python SDK is installed (`pip install daytona`). Authentication is handled via the `DAYTONA_API_KEY` environment variable, which is already set; do not hard-code keys.
- Use `CreateSandboxFromSnapshotParams` to pass a custom sandbox name and a dictionary of environment variables when creating the sandbox.
- Use `sandbox.process.exec(...)` to run shell commands inside the sandbox; the `.result` attribute on the response contains the captured stdout.
- Strip any surrounding whitespace/newlines from the captured stdout before writing it to the log file.
- Make sure cleanup runs even if exec fails (e.g., use a `try`/`finally` block).

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- The sandbox name must be `envvar-py-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The sandbox must be created with environment variables:
  - `MY_VAR=hello-${run-id}`
  - `APP_MODE=production`
- The log file must contain exactly two lines in this order:
  1. `MY_VAR: <value-of-MY_VAR-from-sandbox>`
  2. `APP_MODE: <value-of-APP_MODE-from-sandbox>`
- The sandbox created during the task must be deleted before the script exits.

