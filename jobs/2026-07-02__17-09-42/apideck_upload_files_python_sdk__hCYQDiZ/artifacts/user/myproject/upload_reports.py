"""Upload two small text reports to REDACTED through the Apideck Unify SDK.

The SDK's File Storage resource exposes a ``files`` namespace for normal
operations, but the small ``filesUpload`` (direct upload) endpoint is the
single-call method described in the task. We therefore construct the SDK
client (which gives us authenticated transports and the ``drives`` resource
used to resolve the REDACTED drive id) and then issue the direct upload
HTTP call through the SDK's underlying httpx client.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from apideck_unify import Apideck

RUN_ID_FILE = Path("/logs/artifacts/run-id")
OUTPUT_LOG = Path("/home/user/myproject/output.log")
UPLOAD_URL = "https://upload.apideck.com/file-storage/files"


def _read_run_id() -> str:
    return RUN_ID_FILE.read_text(encoding="utf-8").strip()


def _build_reports(run_id: str):
    return (
        ("alpha", f"report-{run_id}-alpha.txt", f"alpha payload for {run_id}\n"),
        ("beta", f"report-{run_id}-beta.txt", f"beta payload for {run_id}\n"),
    )


def _resolve_drive_id(client: Apideck, drive_name: str, service_id: str) -> str:
    drives_response = client.file_storage.drives.list(service_id=service_id)
    payload = drives_response.get_drives_response
    if payload is None:
        raise RuntimeError("No drives payload returned from Apideck")
    for drive in payload.data:
        if drive.name == drive_name:
            return drive.id
    available = ", ".join(d.name for d in payload.data)
    raise RuntimeError(
        f"Drive named {drive_name!r} not found. Available: {available}"
    )


def _upload_file(
    client: Apideck,
    *,
    name: str,
    content: str,
    drive_id: str,
    service_id: str,
    api_key: str,
) -> str:
    file_bytes = content.encode("utf-8")
    metadata = json.dumps(
        {
            "name": name,
            "parent_folder_id": "root",
            "drive_id": drive_id,
        }
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "x-apideck-app-id": client.sdk_configuration.globals.app_id or "",
        "x-apideck-consumer-id": client.sdk_configuration.globals.consumer_id or "",
        "x-apideck-service-id": service_id,
        "x-apideck-metadata": metadata,
        "Content-Type": "text/plain",
    }

    http_client = client.sdk_configuration.client
    if http_client is None:
        raise RuntimeError("Apideck SDK has no underlying HTTP client configured")

    response = http_client.post(
        UPLOAD_URL,
        headers=headers,
        content=file_bytes,
    )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Upload failed with status {response.status_code}: {response.text[:500]}"
        )

    body = response.json()
    data = body.get("data") or {}
    file_id = data.get("id")
    if not file_id:
        raise RuntimeError(f"Upload response did not include a file id: {body!r}")
    return str(file_id)


def main() -> int:
    api_key = os.environ.get("APIDECK_API_KEY")
    app_id = os.environ.get("APIDECK_APP_ID")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID")
    drive_name = os.environ.get("APIDECK_FILE_STORAGE_DRIVE_NAME")
    service_id = os.environ.get("APIDECK_FILE_STORAGE_SERVICE_ID", "onedrive")

    missing = [
        name
        for name, value in (
            ("APIDECK_API_KEY", api_key),
            ("APIDECK_APP_ID", app_id),
            ("APIDECK_CONSUMER_ID", consumer_id),
            ("APIDECK_FILE_STORAGE_DRIVE_NAME", drive_name),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )

    run_id = _read_run_id()
    if not run_id:
        raise RuntimeError("Run id is empty")

    client = Apideck(api_key=api_key, app_id=app_id, consumer_id=consumer_id)

    drive_id = _resolve_drive_id(client, drive_name, service_id)

    results = {}
    for key, file_name, content in _build_reports(run_id):
        file_id = _upload_file(
            client,
            name=file_name,
            content=content,
            drive_id=drive_id,
            service_id=service_id,
            api_key=api_key,
        )
        results[key] = {"name": file_name, "id": file_id}

    OUTPUT_LOG.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_LOG.write_text(json.dumps(results, separators=(",", ":")), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
