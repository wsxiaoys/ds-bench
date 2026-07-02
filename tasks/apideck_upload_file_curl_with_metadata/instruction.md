# Direct File Upload via Apideck File Storage with curl

## Background
[Apideck](https://www.apideck.com/) exposes a unified **File Storage API** that normalizes cloud-drive providers such as OneDrive, Google Drive, Dropbox, Box, and SharePoint. Unlike the unified API base (`https://unify.apideck.com`), file uploads and downloads must hit a separate host (`https://upload.apideck.com`) and the executor must send the file's metadata as a JSON string in the `x-apideck-metadata` HTTP header while the request body holds the raw binary content. In this task you will use `curl` (not the SDK) to perform a direct upload of a small text file into the configured OneDrive drive and record the resulting unified file ID for verification.

## Requirements
- Project path: `/home/user/myproject`
- Your solution must be written as a script file (e.g., a shell script `.sh` or `.bash`, or a Python script `.py`) persisted under the project path `/home/user/myproject`. This script must invoke the upload using `curl` against the `upload.apideck.com` host and include the `x-apideck-metadata` header. Do not use or import the `apideck-unify` SDK or any wrapper library in any script files.
- Use raw HTTP via the `curl` CLI (do **not** use the `apideck-unify` SDK or any wrapper library) to upload exactly one text file through Apideck's File Storage direct upload endpoint.
- Upload the file into the drive whose `name` (returned by the unified `List Drives` endpoint) equals the value of `APIDECK_FILE_STORAGE_DRIVE_NAME`.
- Place the new file at the **root** of that drive (i.e. `parent_folder_id` = `"root"`).
- The uploaded file must have:
  - file name: `apideck-curl-<run-id>.txt` (the literal prefix `zr` is already part of `/logs/artifacts/run-id`; do not prepend it again).
  - file body: the exact ASCII string `Uploaded via Apideck File Storage direct upload curl test\n` (a single line terminated by one `\n`, no trailing whitespace, 58 bytes total).
  - content type / MIME: `text/plain`.
- After a successful upload, write the unified Apideck file ID returned in `data.id` to `/home/user/myproject/output.log` as the only non-empty line in the file.

## Implementation Hints
- Read `APIDECK_APP_ID`, `APIDECK_API_KEY`, `APIDECK_CONSUMER_ID`, `APIDECK_FILE_STORAGE_DRIVE_NAME`, and `/logs/artifacts/run-id` from the environment.
- Discover the target drive by calling `GET https://unify.apideck.com/file-storage/drives` with the standard Apideck headers and `x-apideck-service-id: onedrive`, then pick the entry whose `name` matches `APIDECK_FILE_STORAGE_DRIVE_NAME` and capture its `id`.
- Send the upload to `POST https://upload.apideck.com/file-storage/files` — note this is a different host than the rest of the unified API. Forgetting to switch hosts is a common source of 404/422 errors.
- The metadata travels in an HTTP header, not the body. Build a JSON string with at minimum `name`, `parent_folder_id`, and `drive_id` and pass it via `-H 'x-apideck-metadata: { ... }'`. The HTTP body must be the raw bytes of the file (`--data-binary @file`), not multipart form data (do not use `-F` / `--form`).
- Always include the headers `Authorization: Bearer <api key>`, `x-apideck-app-id`, `x-apideck-consumer-id`, and `x-apideck-service-id: onedrive` (multiple connectors may be enabled on the unified API, so the service id is required).
- Suggested references: [Uploading Files guide](https://developers.apideck.com/guides/file-upload.md), [Upload File reference](https://developers.apideck.com/md/apis/file-storage/reference/files/filesUpload.md), [List Drives reference](https://developers.apideck.com/md/apis/file-storage/reference/drives/drivesAll.md), [List Files reference](https://developers.apideck.com/md/apis/file-storage/reference/files/filesAll.md).

