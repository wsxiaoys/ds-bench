# Run Python Code in a Daytona Sandbox (Python SDK)

## Background
Daytona provides isolated cloud sandboxes for executing untrusted or agent-generated code. The Python SDK (`daytona`) exposes a sandbox lifecycle API and a `process.code_run(...)` helper for running Python snippets inside a sandbox without booting a long-lived process.

In this task you will use the Daytona Python SDK to create a sandbox, run a small computation inside it via `process.code_run`, persist the result locally, and then clean up the sandbox.

## Requirements
- Write a Python script that uses the Daytona Python SDK.
- Create a Daytona sandbox whose `name` is `code-run-py-${run-id}`, where `${run-id}` comes from `/logs/artifacts/run-id`.
- Inside the sandbox, use `sandbox.process.code_run(...)` to execute a Python snippet that computes the sum of all integers from 1 through 100 (inclusive) and prints the integer result on stdout.
- Capture the printed value from the `code_run` response in your local Python script.
- Write the captured value to `/home/user/myproject/output.log` using the exact format `Result: <value>` on a single line.
- Delete the Daytona sandbox after the result has been captured, even if earlier steps fail.

## Implementation Hints
- Authenticate the SDK using the `DAYTONA_API_KEY` environment variable; do **not** hard-code credentials.
- Read `run-id` from `/logs/artifacts/run-id` and apply it as a suffix to the sandbox name to keep runs isolated.
- `sandbox.process.code_run(code)` returns an object whose `result` attribute contains the captured stdout of the executed snippet.
- Use a `try/finally` (or equivalent) block so that the sandbox is deleted whether or not the code run succeeds.
- The Daytona service is real; never mock the SDK or stub network calls.

