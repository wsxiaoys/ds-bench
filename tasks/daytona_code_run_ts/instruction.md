# Run Code in a Daytona Sandbox with the TypeScript SDK

## Background
Daytona provides secure, isolated sandboxes that can execute code on demand. The TypeScript SDK exposes a `process.codeRun(...)` helper that runs a code snippet inside a sandbox and returns its captured stdout. In this task you will use the Daytona TypeScript SDK to spin up a fresh sandbox, run a small JavaScript/TypeScript snippet that computes a numeric result, persist that result to a local log file, and clean up the sandbox.

## Requirements
- Write a TypeScript/Node.js program under `/home/user/myproject` that uses the `@daytonaio/sdk` package to talk to the real Daytona SaaS API.
- Create a Daytona sandbox with `language: 'typescript'`. The sandbox name (label) must be `code-run-ts-<run-id>` where `<run-id>` is read from `/logs/artifacts/run-id`.
- Inside the sandbox, use `sandbox.process.codeRun(...)` to execute a snippet that computes the factorial of 6 and prints the integer result on stdout.
- Capture the captured result from the `codeRun` response back in your host program and write it to the log file `/home/user/myproject/output.log` in the format `Factorial: <value>` (a single line, exact prefix `Factorial: ` followed by the integer).
- Delete the sandbox at the end of the run, including on failure paths.

## Implementation Hints
- Install `@daytonaio/sdk` with npm and authenticate by reading `DAYTONA_API_KEY` from the environment.
- The TypeScript SDK pattern is roughly: `const daytona = new Daytona(); const sandbox = await daytona.create({ language: 'typescript', ... }); const res = await sandbox.process.codeRun(snippet); await daytona.delete(sandbox);`.
- Pass the sandbox name via the `labels` or equivalent option supported by `daytona.create(...)` so it can be discovered by name.
- Use `response.result` from `codeRun` as the value emitted by the snippet's `console.log` and trim any surrounding whitespace before writing the log line.
- Make sure the program exits with a non-zero status if the SDK reports a non-zero `exitCode` so failures surface cleanly.

