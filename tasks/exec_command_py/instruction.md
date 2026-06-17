# Execute Shell Commands in a Daytona Sandbox (Python SDK)

## Background
You are building a small automation prototype that uses the Daytona Python SDK to execute a sequence of shell commands inside a remote Daytona sandbox, collect their output, and persist a structured log locally. Daytona provides isolated Linux sandboxes that you can drive programmatically through the `daytona` Python package and the `sandbox.process.exec(...)` API.

The `DAYTONA_API_KEY` environment variable is already set in the environment so the SDK can authenticate against the real Daytona SaaS endpoint.

## Requirements
- Write a Python script that uses the Daytona Python SDK to:
  - Create a new sandbox whose name is `exec-py-${run-id}` (where `run-id` is read from the `ZEALT_RUN_ID` environment variable).
  - Execute `uname -a` inside the sandbox via `sandbox.process.exec(...)`.
  - Execute `pwd` inside the sandbox via `sandbox.process.exec(...)`.
  - Execute `echo ${ZEALT_RUN_ID}` inside the sandbox via `sandbox.process.exec(...)` so that the value of `ZEALT_RUN_ID` from the local environment is echoed back.
  - Persist the results of all three commands to a local log file at `/home/user/myproject/output.log`, one prefixed line per command, in the order they were run.
  - Delete the sandbox at the end of the run, even on partial failure.

## Implementation Hints
- Authenticate by relying on the `DAYTONA_API_KEY` environment variable; you do not need to hard-code any credentials.
- Use the synchronous `Daytona` client and call `sandbox.process.exec(<command>)` to run each shell command; the returned object exposes the captured stdout (e.g. via `.result`).
- Read `run-id` from the `ZEALT_RUN_ID` environment variable and use it both to name the sandbox and as the value echoed by the `echo` command.
- Always clean up the sandbox at the end (for example by wrapping the work in `try/finally` and calling `daytona.delete(sandbox)` or the equivalent SDK call), so that no orphaned sandboxes are left behind.
- Do NOT mock the Daytona service; the script must talk to the real Daytona SaaS endpoint.

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- Use the Daytona Python SDK (`daytona` package) and `sandbox.process.exec(...)` to run each command.
- The sandbox name must be `exec-py-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The log file must contain, in order, exactly these three prefixed lines (one per command, in the same order as they were executed):
  - A line starting with `UNAME: ` followed by the captured stdout of `uname -a`.
  - A line starting with `PWD: ` followed by the captured stdout of `pwd`.
  - A line starting with `ECHO: ` followed by the captured stdout of `echo ${ZEALT_RUN_ID}` (which must equal the value of `ZEALT_RUN_ID`).
- The sandbox must be deleted by the end of the run.

