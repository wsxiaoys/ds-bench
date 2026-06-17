# Run Python Code in a Daytona Sandbox (Python SDK)

## Background
Daytona provides isolated cloud sandboxes for executing untrusted or agent-generated code. The Python SDK (`daytona`) exposes a sandbox lifecycle API and a `process.code_run(...)` helper for running Python snippets inside a sandbox without booting a long-lived process.

In this task you will use the Daytona Python SDK to create a sandbox, run a small computation inside it via `process.code_run`, persist the result locally, and then clean up the sandbox.

## Requirements
- Write a Python script that uses the Daytona Python SDK.
- Create a Daytona sandbox whose `name` is `code-run-py-${run-id}`, where `${run-id}` comes from the `ZEALT_RUN_ID` environment variable.
- Inside the sandbox, use `sandbox.process.code_run(...)` to execute a Python snippet that computes the sum of all integers from 1 through 100 (inclusive) and prints the integer result on stdout.
- Capture the printed value from the `code_run` response in your local Python script.
- Write the captured value to `/home/user/myproject/output.log` using the exact format `Result: <value>` on a single line.
- Delete the Daytona sandbox after the result has been captured, even if earlier steps fail.

## Implementation Hints
- Authenticate the SDK using the `DAYTONA_API_KEY` environment variable; do **not** hard-code credentials.
- Read `run-id` from the `ZEALT_RUN_ID` environment variable and apply it as a suffix to the sandbox name to keep runs isolated.
- `sandbox.process.code_run(code)` returns an object whose `result` attribute contains the captured stdout of the executed snippet.
- Use a `try/finally` (or equivalent) block so that the sandbox is deleted whether or not the code run succeeds.
- The Daytona service is real; never mock the SDK or stub network calls.

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- Use the Daytona Python SDK (`daytona` package) to create and delete the sandbox.
- The sandbox name must be `code-run-py-${run-id}` where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The sandbox must execute the computation via `sandbox.process.code_run(...)` (a stateless Python code run inside the sandbox).
- After the script completes, `/home/user/myproject/output.log` must exist and contain a line in the exact format `Result: <value>`, where `<value>` is the integer printed by the sandboxed snippet.
- The Daytona sandbox created for this run must no longer exist after the script finishes.

