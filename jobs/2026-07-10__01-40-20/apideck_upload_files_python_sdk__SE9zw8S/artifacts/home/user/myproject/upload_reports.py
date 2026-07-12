#!/usr/bin/env python3
"""Upload a small batch of plain-text reports to the root of a REDACTED drive
via the apideck-unify Python SDK, then record the returned Apideck file IDs.

The script:
  1. Reads the run id from /logs/artifacts/run-id.
  2. Resolves the configured drive (APIDECK_FILE_STORAGE_DRIVE_NAME) by listing
     the File Storage drives and matching on name.
  3. Uploads two text files (report-<run-id>-alpha.txt and ...-beta.txt) to the
     root of that drive using the SDK's upload-session flow (create -> upload ->
     finish), which is the binary upload path exposed by the SDK.
  4. Writes a single-line JSON object with the file names + Apideck file IDs to
     /home/user/myproject/output.log.
"""

import json
import os
import sys

from apideck_unify import Apideck

RUN_ID_PATH = "/logs/artifacts/run-id"
OUTPUT_PATH = "/home/user/myproject/output.log"

# The REDACTED connector service id used by Apideck Unify.
ONEDRIVE_SERVICE_ID = "onedrive"


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.stderr.write(f"Missing required environment variable: {name}\n")
        sys.exit(1)
    return value


def read_run_id() -> str:
    with open(RUN_ID_PATH, "r", encoding="utf-8") as fh:
        return fh.read().strip()


def resolve_drive_id(client: Apideck, drive_name: str, service_id: str) -> str:
    """List File Storage drives and return the id of the drive whose name matches."""
    response = client.file_storage.drives.list(
        service_id=service_id, limit=200
    )

    while response is not None:
        drives_resp = response.get_drives_response
        if drives_resp is not None and drives_resp.data:
            for drive in drives_resp.data:
                if drive.name == drive_name:
                    return drive.id
        # Paginate to the next page of drives.
        response = response.next() if response.next else None

    raise RuntimeError(
        f"Could not find a drive named '{drive_name}' for service '{service_id}'"
    )


def upload_file(
    client: Apideck,
    *,
    name: str,
    content_bytes: bytes,
    drive_id: str,
    service_id: str,
) -> str:
    """Upload a single file via an upload session and return the new file id.

    The SDK exposes binary uploads through the upload-sessions resource:
      - create: start a session (name, parent folder, drive, size)
      - upload: push the raw bytes for a part
      - finish: complete the session and return the created file
    """
    # 1. Start the upload session. The file goes to the root folder ("root").
    create_resp = client.file_storage.upload_sessions.create(
        name=name,
        parent_folder_id="root",
        size=len(content_bytes),
        drive_id=drive_id,
        service_id=service_id,
    )
    session_id = create_resp.create_upload_session_response.data.id

    # 2. Upload the (single) part containing the full file payload.
    client.file_storage.upload_sessions.upload(
        id=session_id,
        part_number=1,
        request_body=content_bytes,
        service_id=service_id,
    )

    # 3. Finish the session; the response carries the created UnifiedFile.
    finish_resp = client.file_storage.upload_sessions.finish(
        id=session_id, service_id=service_id
    )

    file_data = finish_resp.get_file_response.data
    file_id = file_data.id
    if not file_id:
        raise RuntimeError(f"Upload of '{name}' did not return a file id")
    return file_id


def main() -> None:
    api_key = _require_env("APIDECK_API_KEY")
    app_id = _require_env("APIDECK_APP_ID")
    consumer_id = _require_env("APIDECK_CONSUMER_ID")
    drive_name = _require_env("APIDECK_FILE_STORAGE_DRIVE_NAME")

    run_id = read_run_id()

    alpha_name = f"report-{run_id}-alpha.txt"
    beta_name = f"report-{run_id}-beta.txt"
    alpha_content = f"alpha payload for {run_id}\n".encode("utf-8")
    beta_content = f"beta payload for {run_id}\n".encode("utf-8")

    client = Apideck(api_key=api_key, consumer_id=consumer_id, app_id=app_id)

    drive_id = resolve_drive_id(client, drive_name, ONEDRIVE_SERVICE_ID)
    sys.stderr.write(
        f"Resolved drive '{drive_name}' -> id '{drive_id}' (service={ONEDRIVE_SERVICE_ID})\n"
    )

    alpha_id = upload_file(
        client,
        name=alpha_name,
        content_bytes=alpha_content,
        drive_id=drive_id,
        service_id=ONEDRIVE_SERVICE_ID,
    )
    sys.stderr.write(f"Uploaded {alpha_name} -> id '{alpha_id}'\n")

    beta_id = upload_file(
        client,
        name=beta_name,
        content_bytes=beta_content,
        drive_id=drive_id,
        service_id=ONEDRIVE_SERVICE_ID,
    )
    sys.stderr.write(f"Uploaded {beta_name} -> id '{beta_id}'\n")

    result = {
        "alpha": {"name": alpha_name, "id": alpha_id},
        "beta": {"name": beta_name, "id": beta_id},
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(result, separators=(",", ":")))

    sys.stderr.write(f"Wrote {OUTPUT_PATH}\n")


if __name__ == "__main__":
    main()