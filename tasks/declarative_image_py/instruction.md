# Build a Daytona Sandbox from a Declarative Image (Python SDK)

## Background
Daytona's Declarative Builder lets you define sandbox images programmatically using the Python SDK instead of pulling pre-built container images from a registry. In this task, you will use the Daytona Python SDK to define a declarative image, spin up a sandbox built from that image, run code inside it that depends on the declaratively installed packages, and capture the result on the host.

## Requirements
- Read the current `run-id` from the `ZEALT_RUN_ID` environment variable.
- Use the Daytona Python SDK to build a declarative `Image` based on `debian_slim('3.12')` with the Python packages `requests` and `pyyaml` installed via `pip_install`.
- Create a sandbox whose name is `decl-py-${run-id}` from that declarative image (using `CreateSandboxFromImageParams`).
- Use `sandbox.process.code_run` to execute a Python snippet inside the sandbox that imports `requests` and `yaml` and prints their installed versions.
- Capture the output and write it to a log file on the host running the task.
- Delete the sandbox before exiting.

## Implementation Hints
- Install and authenticate with the Daytona Python SDK using the `DAYTONA_API_KEY` environment variable that is already provided in the environment.
- Use `Image.debian_slim('3.12').pip_install([...])` from `daytona` to construct the declarative image, and pass it through `CreateSandboxFromImageParams(image=...)` to `daytona.create(...)`.
- The sandbox name can be supplied via the sandbox creation parameters (e.g., the `name` field on `CreateSandboxFromImageParams`).
- `sandbox.process.code_run` returns an object whose `result` attribute contains the captured stdout from the executed Python snippet; parse the printed versions and write them in the required format on the host.
- Make sure the sandbox is deleted at the end, even if it was successfully created.
- Do not mock the Daytona service; interact with the real Daytona SaaS.

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- The sandbox created in Daytona must be named `decl-py-${run-id}`, where `run-id` is read from the `ZEALT_RUN_ID` environment variable.
- The sandbox must be built from a declarative `Image` based on `debian_slim('3.12')` with `requests` and `pyyaml` installed via `pip_install`.
- The log file must contain exactly two lines (in any order) with the following formats:
  - `requests: <version>` where `<version>` is the installed `requests` package version (a dotted version string such as `2.32.3`).
  - `yaml: <version>` where `<version>` is the installed `PyYAML` runtime version reported by `yaml.__version__` (a dotted version string such as `6.0.2`).
- The sandbox `decl-py-${run-id}` must be deleted after the task completes.

