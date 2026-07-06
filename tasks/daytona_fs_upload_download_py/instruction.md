# Daytona File Upload and Download with Python SDK

## Background
You need to demonstrate transferring files in and out of a Daytona sandbox using the Daytona Python SDK. The script will provision an ephemeral sandbox, upload a local input file, transform it remotely with a shell command, download the transformed file back to the local filesystem, and clean up.

## Requirements
- Write a Python script that uses the Daytona Python SDK to perform the entire flow end-to-end.
- Create a Daytona sandbox whose name (label) is exactly `fs-py-${run-id}` (where `run-id` is read from `/logs/artifacts/run-id`).
- Create a local input file under the project directory at `/home/user/myproject/input.txt` with the content exactly `Hello Daytona ${run-id}` and upload it to the sandbox via the SDK file system API.
- Run a shell command (e.g., using `tr`) inside the sandbox to convert the uploaded file's contents to uppercase, writing the result to a new file in the sandbox.
- Download the transformed file from the sandbox back to the project directory at `/home/user/myproject/output.txt` via the SDK file system API.
- Delete the sandbox at the end of the run.
- Write the confirmation line `Upload+Download OK` to a log file at `/home/user/myproject/output.log` once the upload and download both succeed.

## Implementation Hints
- Read the current `run-id` from `/logs/artifacts/run-id`.
- The `DAYTONA_API_KEY` environment variable is preconfigured for authenticating to the Daytona SaaS.
- Use `Daytona().create(...)` to provision a sandbox and pass a label/name derived from `run-id`.
- Use `sandbox.fs.upload_file(content, remote_path)` to push the local file into the sandbox.
- Use `sandbox.process.exec(...)` to run the in-sandbox shell transformation.
- Use `sandbox.fs.download_file(remote_path)` to retrieve the transformed file's bytes; write them locally.
- Make sure to delete the sandbox even if upstream steps fail, so resources do not leak.

