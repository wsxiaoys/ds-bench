# Build a Sandbox from a Declarative Image with the Daytona TypeScript SDK

## Background
Daytona's declarative builder lets you define a sandbox image programmatically with the `Image` helper, install Python packages via `pipInstall`, and pass the image directly to `daytona.create({ image })`. You will use the official `@daytonaio/sdk` TypeScript package against the real Daytona SaaS endpoint (`https://app.daytona.io/api`). The credentials are provided in the `DAYTONA_API_KEY` environment variable.

## Requirements
- Write a TypeScript (Node.js) program that uses the `@daytonaio/sdk` package.
- Build a declarative `Image` using `Image.debianSlim('3.12').pipInstall(['flask', 'click'])`.
- Create a sandbox from that declarative image. The sandbox name must be `decl-ts-<run-id>` (with `/logs/artifacts/run-id` read from the environment).
- Inside the sandbox, run the Python command:

  ```
  python3 -c "import flask, click; print('flask', flask.__version__); print('click', click.__version__)"
  ```

  using `sandbox.process.executeCommand`.
- Capture both lines of the command's stdout and write them, in order, to `/home/user/myproject/output.log` on the host (the task execution environment), one line per print.
- After capturing the output, delete the sandbox via the Daytona API.

## Implementation Hints
- Initialize the SDK with `new Daytona({ apiKey: process.env.DAYTONA_API_KEY })`. The default API URL `https://app.daytona.io/api` is fine.
- Pass the `Image` instance directly as the `image` property of the `CreateSandboxFromImageParams` argument to `daytona.create(...)`. Daytona will build a snapshot on demand; building can take a while, so use a generous `timeout` (e.g. `0` for no timeout).
- Use `sandbox.process.executeCommand` and read its `.result` (stdout) field; write that result verbatim to the log file.
- Always delete the sandbox at the end (use `daytona.delete(sandbox)`), even on errors.
- Project must live under `/home/user/myproject` (use it as your working directory for the Node.js project: `package.json`, code, and `output.log`).
- Read `run-id` from `/logs/artifacts/run-id` before creating the sandbox and use it as the sandbox name suffix to keep parallel runs isolated.

