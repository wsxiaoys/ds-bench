# List Daytona Sandboxes with the Daytona CLI

## Background
You are working with the [Daytona](https://www.daytona.io/docs/en/tools/cli) CLI, which provides command-line access to Daytona's managed sandbox service. In this task you will authenticate, create a uniquely-named sandbox, list all sandboxes belonging to the current account, and persist the listing JSON together with a summary line describing the created sandbox.

## Requirements
- Authenticate the Daytona CLI using the API key stored in the `DAYTONA_API_KEY` environment variable.
- Create a new sandbox whose name is `lst-${ZEALT_RUN_ID}` (where `ZEALT_RUN_ID` is the run identifier read from the environment).
- Capture the full JSON listing of sandboxes for the authenticated account into a file under the project directory.
- Record a one-line human-readable summary about the freshly created sandbox in a log file.

## Implementation Hints
- Use `daytona login --api-key $DAYTONA_API_KEY` to authenticate non-interactively.
- Use `daytona create --name <name>` to create the sandbox; the default snapshot is fine.
- Use `daytona list --format json` to obtain machine-readable output, then process the JSON with a tool like `jq` to extract the id of the sandbox you just created.
- Write the entire `daytona list --format json` output to `sandboxes.json` and the one-line summary to `output.log`.
- The whole flow should be a short shell script (2-5 commands) and may optionally clean up the sandbox afterwards.

## Acceptance Criteria
- Project path: /home/user/myproject
- Log file: /home/user/myproject/output.log
- Sandboxes JSON file: /home/user/myproject/sandboxes.json
- The Daytona CLI must be authenticated using `DAYTONA_API_KEY` from the environment.
- A sandbox named `lst-${ZEALT_RUN_ID}` (with `ZEALT_RUN_ID` read from the environment) must exist in the account by the time the task finishes.
- `sandboxes.json` must contain the verbatim JSON output of `daytona list --format json` and must include an entry whose name matches `lst-${ZEALT_RUN_ID}`.
- `output.log` must contain a single line in the exact format: `Created: lst-<run-id> with id <sandbox-id>`, where `<sandbox-id>` is the id of the created sandbox as reported by `daytona list --format json`.

