#!/usr/bin/env python3
"""Upload two text reports to the configured REDACTED drive via the Apideck SDK."""

import json
import os
import sys

from apideck_unify import Apideck


def main() -> int:
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    drive_name = os.environ.get("APIDECK_FILE_STORAGE_DRIVE_NAME")

    if not all([api_key, app_id, consumer_id, drive_name]):
        print("Missing required Apideck environment variables.", file=sys.stderr)
        return 1

    with open("/logs/artifacts/run-id", "r", encoding="utf-8") as f:
        run_id = f.read().strip()

    client = Apideck(
        api_key=api_key,
        app_id=app_id,
        consumer_id=consumer_id,
    )

    # Resolve the drive id by name.
    drives_resp = client.file_storage.drives.list(limit=200)
    drive_id = None
    if drives_resp is not None and drives_resp.get_drives_response is not None:
        for d in drives_resp.get_drives_response.data:
            if d.name == drive_name:
                drive_id = d.id
                break
    if not drive_id:
        print(f"Drive named '{drive_name}' not found.", file=sys.stderr)
        return 1

    uploads = [
        (
            f"report-{run_id}-alpha.txt",
            f"alpha payload for {run_id}\n".encode("utf-8"),
        ),
        (
            f"report-{run_id}-beta.txt",
            f"beta payload for {run_id}\n".encode("utf-8"),
        ),
    ]

    file_ids = {}
    for name, payload in uploads:
        size = len(payload)
        create_resp = client.file_storage.upload_sessions.create(
            name=name,
            parent_folder_id="root",
            drive_id=drive_id,
            size=size,
            service_id="onedrive",
        )
        session_id = create_resp.create_upload_session_response.data.id

        upload_resp = client.file_storage.upload_sessions.upload(
            id=session_id,
            part_number=1,
            request_body=payload,
            service_id="onedrive",
        )

        finish_resp = client.file_storage.upload_sessions.finish(
            id=session_id,
            service_id="onedrive",
        )

        new_id = finish_resp.get_file_response.data.id
        if not new_id:
            print(f"No file id returned for {name}", file=sys.stderr)
            return 1
        file_ids[name] = new_id

    output = {
        "alpha": {
            "name": f"report-{run_id}-alpha.txt",
            "id": file_ids[f"report-{run_id}-alpha.txt"],
        },
        "beta": {
            "name": f"report-{run_id}-beta.txt",
            "id": file_ids[f"report-{run_id}-beta.txt"],
        },
    }

    with open("/home/user/myproject/output.log", "w", encoding="utf-8") as f:
        f.write(json.dumps(output) + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
