# Create a Daytona Snapshot from a Public Image Using the Daytona CLI

## Background
Daytona snapshots are sandbox templates created from container images. They define the base environment that Daytona sandboxes are launched from. Using the Daytona CLI, you can authenticate against the Daytona Cloud API, register a new snapshot built from any publicly accessible image, and then list snapshots in machine-readable form.

In this task you will use the `daytona` CLI binary (already installed in the environment) together with `jq` to create a snapshot from the public `python:3.11-slim` image, capture the list of snapshots as JSON, and record the new snapshot's identifier in a log file.

## Requirements
- Authenticate the Daytona CLI against the live Daytona Cloud control plane using the API key from the `DAYTONA_API_KEY` environment variable.
- Create a new snapshot whose name is derived from the current `run-id` to keep parallel runs isolated.
- Use the public Docker Hub image `python:3.11-slim` as the snapshot's base image.
- Capture the full snapshot listing as JSON to `/home/user/myproject/snapshots.json`. This file must contain the JSON output of `daytona snapshot list --format json`, including the entry for the newly created snapshot.
- Write a single-line summary to a log file at `/home/user/myproject/output.log` in the exact format:
  `Snapshot: snap-<run-id> -> id <snapshot-id>`
  where `<run-id>` is the `/logs/artifacts/run-id` value and `<snapshot-id>` is the snapshot ID returned by the Daytona API.

## Implementation Hints
- Read the current `run-id` from `/logs/artifacts/run-id` and build the snapshot name as `snap-${run-id}`.
- Use `daytona login --api-key "$DAYTONA_API_KEY"` to authenticate before any other CLI calls.
- Use `daytona snapshot create <name> --image python:3.11-slim` to create the snapshot. The CLI blocks until the snapshot is validated.
- Use `daytona snapshot list --format json` to obtain the machine-readable snapshot inventory, and `jq` to extract the `id` field for the entry whose `name` matches `snap-${run-id}`.
- Write the snapshot listing JSON to `/home/user/myproject/snapshots.json` and the summary log file to `/home/user/myproject/output.log`.

