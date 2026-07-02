# List Daytona Sandboxes with the Daytona CLI

## Background
You are working with the [Daytona](https://www.daytona.io/docs/en/tools/cli) CLI, which provides command-line access to Daytona's managed sandbox service. In this task you will authenticate, create a uniquely-named sandbox, list all sandboxes belonging to the current account, and persist the listing JSON together with a summary line describing the created sandbox.

## Requirements
- Project path: `/home/user/myproject`
- Authenticate the Daytona CLI using the API key stored in the `DAYTONA_API_KEY` environment variable.
- Create a new sandbox whose name is `lst-<run-id>` (where `/logs/artifacts/run-id` is the run identifier read from the environment).
- Capture the full JSON listing of sandboxes for the authenticated account into `/home/user/myproject/sandboxes.json`.
- Record a one-line summary in `/home/user/myproject/output.log` in the exact format: `Created: lst-<run-id> with id <sandbox-id>`, where `<sandbox-id>` is the id of the created sandbox as reported by `daytona list --format json`.

## Implementation Hints
- Use `daytona login --api-key $DAYTONA_API_KEY` to authenticate non-interactively.
- Use `daytona create --name <name>` to create the sandbox; the default snapshot is fine.
- Use `daytona list --format json` to obtain machine-readable output, then process the JSON with a tool like `jq` to extract the id of the sandbox you just created.
- Write the entire `daytona list --format json` output to `/home/user/myproject/sandboxes.json` and the one-line summary to `/home/user/myproject/output.log`.
- The whole flow should be a short shell script (2-5 commands) and may optionally clean up the sandbox afterwards.

