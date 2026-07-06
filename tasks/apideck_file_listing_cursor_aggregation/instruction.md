# Aggregate Files With Cursor Pagination (Apideck File Storage)

## Background
Use the Apideck unified File Storage API (connected to OneDrive) to upload a fixed set of files, then walk the file listing using cursor pagination to aggregate identifiers across pages.

The project should be developed inside `/home/user/apideck_task`.

## Requirements
- Upload 7 distinct small text files at the drive root of the OneDrive drive named in `APIDECK_FILE_STORAGE_DRIVE_NAME`. The files must be named `AGG-<run-id>-1.txt` through `AGG-<run-id>-7.txt`, where `<run-id>` is read from `/logs/artifacts/run-id`.
- After uploading, use cursor pagination with a page size of 3 (`limit=3`) to walk the file listing and aggregate every file whose name starts with the prefix `AGG-<run-id>-`.
- Emit a JSON summary of the aggregation to the log file `/home/user/apideck_task/output.log`. The summary must be a single JSON object containing:
  - `count`: integer equal to 7.
  - `ids`: array of strings, each being the Apideck file id of a file matching the prefix.

## Implementation Hints
- Read `APIDECK_APP_ID`, `APIDECK_API_KEY`, `APIDECK_CONSUMER_ID`, `APIDECK_FILE_STORAGE_DRIVE_NAME`, and `/logs/artifacts/run-id` from the environment.
- File uploads must hit the upload host; listing happens on the unify host. The service id for OneDrive is `onedrive`.
- Each List Files response exposes a `meta.cursors.next` value; pass it back as the `cursor` query parameter to fetch the next page. Stop only once `next` is empty.
- The aggregation must include only files whose names start with the run-scoped prefix, regardless of which page they appear on.

