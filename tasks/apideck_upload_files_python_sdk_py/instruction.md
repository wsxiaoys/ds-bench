# Upload Multiple Files to OneDrive via the Apideck Python SDK

## Background
Apideck Unify exposes a normalized File Storage API over 200+ connectors at `https://unify.apideck.com`, but file uploads (and downloads) actually go through a separate host: `https://upload.apideck.com`. The official Python SDK (`apideck-unify`) hides that detail and lets you upload binary payloads through a single method call. In this task you will use the Python SDK to push a small batch of plain-text reports into the consumer's configured OneDrive drive and record the returned file IDs so a downstream verifier can locate them.

## Requirements
- Implement a Python script at `/home/user/myproject/upload_reports.py` that uses the `apideck-unify` SDK (not raw `requests`/`curl`) to upload two text files to the root of the OneDrive drive named `APIDECK_FILE_STORAGE_DRIVE_NAME`.
- The two uploaded files must be named `report-${run-id}-alpha.txt` and `report-${run-id}-beta.txt`, where `${run-id}` comes from `/logs/artifacts/run-id`. Their contents must be the literal strings `alpha payload for ${run-id}\n` and `beta payload for ${run-id}\n` respectively (UTF-8, ending with a single newline).
- After both uploads succeed, write a single JSON object to `/home/user/myproject/output.log` (on a single line, with no extra keys or trailing comma) containing the two returned Apideck file IDs and the file names in the following format, then exit cleanly:
  ```json
  {"alpha": {"name": "report-${run-id}-alpha.txt", "id": "<apideck file id>"}, "beta": {"name": "report-${run-id}-beta.txt", "id": "<apideck file id>"}}
  ```
  Both `id` values must be non-empty strings returned by the Apideck upload call.

## Implementation Hints
- Install and import the `apideck-unify` Python SDK (`pip install apideck-unify`). Construct the client with `api_key`, `app_id`, and `consumer_id` read from environment variables.
- The OneDrive connector is enabled in the dashboard; pass its service id when calling the File Storage upload method.
- Resolve the configured drive (whose name is in `APIDECK_FILE_STORAGE_DRIVE_NAME`) before uploading so you can pass its drive id. The unified File Storage API exposes a `drives` resource that you can list to find the matching drive id by name.
- For each upload, pass the file name, the parent folder id (`"root"`), the resolved drive id, and the raw bytes of the file. Capture the returned upload response and read the new file id from it.

