# Execute Shell Commands in a Daytona Sandbox (TypeScript SDK)

## Background
Daytona provides on-demand Linux sandboxes that can be controlled programmatically through the `@daytona/sdk` TypeScript SDK. Each sandbox exposes a `process.executeCommand` method that runs an arbitrary shell command inside the sandbox and returns the captured output. In this task you will use the SDK to run a small set of inspection commands inside a freshly created sandbox and persist the results back on the local task machine.

## Requirements
- Implement a Node.js program (TypeScript or JavaScript) in `/home/user/myproject` that uses the `@daytona/sdk` package and the real Daytona SaaS API (no mocking).
- The program must, in order:
  1. Create a new Daytona sandbox named `exec-ts-${run-id}` where `run-id` is read from `/logs/artifacts/run-id`.
  2. Run `cat /etc/os-release` inside the sandbox and record the captured stdout in the local log file (`/home/user/myproject/output.log`).
  3. Run `node --version` inside the sandbox and record the captured stdout in the local log file.
  4. Run `echo <run-id>` inside the sandbox (so the sandbox echoes the same run-id value that the local environment sees) and record the captured stdout in the local log file.
  5. Delete the sandbox before the program exits.
- Authenticate against the Daytona SaaS using the `DAYTONA_API_KEY` environment variable.

## Implementation Hints
- Install `@daytona/sdk` in the project directory and authenticate via the `DAYTONA_API_KEY` environment variable (the SDK reads it automatically when no explicit config is given).
- Use `daytona.create(...)` to provision a sandbox and pass the `/logs/artifacts/run-id` value into the sandbox environment (e.g. via `envVars`) so the sandbox-side `echo` step can see it.
- Use `sandbox.process.executeCommand(<command>)` to run each command and read the captured stdout from the returned response's `result` field.
- Append the captured output of each command to the local log file with the required line prefix (`OS: `, `NODE: `, `ECHO: `) so each captured payload is preserved on its own labeled line(s).
- Always tear the sandbox down at the end (use `try`/`finally` or equivalent) so that failures do not leak sandboxes.

