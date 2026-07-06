# Mount a Daytona Volume to a Sandbox (Python SDK)

## Background
Daytona Volumes are FUSE-based mounts that provide shared, persistent file storage that survives the lifecycle of any individual sandbox. They are useful for sharing datasets, caches, or application state across sandboxes. Your task is to use the Daytona Python SDK to provision a volume, mount it inside a fresh sandbox, write and read a marker file through the mounted volume, and record what you observed.

## Requirements
- Use the Daytona Python SDK (`pip install daytona`) and the `DAYTONA_API_KEY` environment variable to authenticate.
- Read the `run-id` from `/logs/artifacts/run-id` and use it for all resource naming.
- Get-or-create a Daytona Volume whose name is `vol-<run-id>`.
- Create a fresh sandbox named `vol-py-<run-id>` that mounts the volume at `/data`.
- Inside the sandbox, write a marker file at `/data/marker.txt` on the mounted volume containing the text `persistent <run-id>`, then read it back.
- Record the marker contents and the total number of Daytona volumes visible to your account in a log file at `/home/user/myproject/output.log`.
- Clean up by deleting the sandbox after the work is complete.

## Implementation Hints
- Use `daytona.volume.get(name, create=True)` to obtain (or create) the volume in one call.
- Pass `VolumeMount(volume_id=..., mount_path="/data")` inside `CreateSandboxFromSnapshotParams(volumes=[...])` when creating the sandbox.
- Use the sandbox `process.exec(...)` (or equivalent) interface to run shell commands inside the sandbox.
- Use `daytona.volume.list()` to enumerate volumes for the count.
- Do not mock any Daytona API; this task must talk to the real Daytona service.
- The log file at `/home/user/myproject/output.log` must contain exactly two lines (order does not matter):
  - `Marker: <content>` where `<content>` is the exact text read back from `/data/marker.txt` inside the sandbox (expected: `persistent <run-id>`).
  - `VolumeCount: <n>` where `<n>` is the integer count returned by `daytona.volume.list()` (must be a positive integer).

