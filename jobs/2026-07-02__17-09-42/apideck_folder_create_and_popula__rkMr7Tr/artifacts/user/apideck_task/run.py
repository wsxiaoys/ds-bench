#!/usr/bin/env python3
"""Create a folder at the REDACTED drive root and upload 3 text files into it.

Reads the run-id from /logs/artifacts/run-id, finds the drive whose name
matches APIDECK_FILE_STORAGE_DRIVE_NAME, then creates FOLDER-${run-id} at the
drive root and uploads NOTE-${run-id}-{1,2,3}.txt into that folder. Persists
the resulting Apideck ids to /home/user/apideck_task/output.log.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

UNIFY_BASE = "https://unify.apideck.com"
UPLOAD_BASE = "https://upload.apideck.com"
RUN_ID_PATH = Path("/logs/artifacts/run-id")
LOG_PATH = Path("/home/user/apideck_task/output.log")
SERVICE_ID = "onedrive"


def build_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {os.environ['APIDECK_API_KEY']}",
        "x-apideck-app-id": os.environ["APIDECK_APP_ID"],
        "x-apideck-consumer-id": os.environ["APIDECK_CONSUMER_ID"],
        "x-apideck-service-id": SERVICE_ID,
    }
    if extra:
        headers.update(extra)
    return headers


def http_request(
    method: str,
    url: str,
    *,
    body: bytes | None = None,
    headers: dict[str, str],
    label: str,
) -> dict:
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{label} failed: HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{label} failed: {exc}") from exc

    if status >= 400:
        raise RuntimeError(f"{label} failed: HTTP {status}: {payload}")
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{label} returned non-JSON: {payload[:500]}") from exc


def resolve_drive_id(target_name: str) -> str:
    headers = build_headers({"Accept": "application/json"})
    data = http_request(
        "GET",
        f"{UNIFY_BASE}/file-storage/drives",
        headers=headers,
        label="list drives",
    )
    drives = data.get("data") or []
    for drive in drives:
        if drive.get("name") == target_name:
            drive_id = drive.get("id")
            if not drive_id:
                raise RuntimeError(f"Drive {target_name!r} has no id: {drive}")
            return drive_id
    raise RuntimeError(
        f"Drive named {target_name!r} not found. Available: "
        + ", ".join(str(d.get("name")) for d in drives)
    )


def create_folder(drive_id: str, folder_name: str) -> str:
    headers = build_headers(
        {"Content-Type": "application/json", "Accept": "application/json"}
    )
    body = json.dumps(
        {
            "name": folder_name,
            "parent_folder_id": "root",
            "drive_id": drive_id,
        }
    ).encode("utf-8")
    data = http_request(
        "POST",
        f"{UNIFY_BASE}/file-storage/folders",
        body=body,
        headers=headers,
        label=f"create folder {folder_name}",
    )
    folder = data.get("data") or {}
    folder_id = folder.get("id")
    if not folder_id:
        raise RuntimeError(f"Folder create response missing data.id: {data}")
    return folder_id


def upload_file(
    drive_id: str,
    parent_folder_id: str,
    file_name: str,
    payload: bytes,
) -> str:
    metadata = json.dumps(
        {
            "name": file_name,
            "parent_folder_id": parent_folder_id,
            "drive_id": drive_id,
        }
    )
    headers = build_headers(
        {
            "Content-Type": "application/octet-stream",
            "x-apideck-metadata": metadata,
        }
    )
    data = http_request(
        "POST",
        f"{UPLOAD_BASE}/file-storage/files",
        body=payload,
        headers=headers,
        label=f"upload {file_name}",
    )
    file_obj = data.get("data") or {}
    file_id = file_obj.get("id")
    if not file_id:
        raise RuntimeError(f"Upload response missing data.id: {data}")
    return file_id


def main() -> int:
    run_id = RUN_ID_PATH.read_text().strip()
    drive_name = os.environ["APIDECK_FILE_STORAGE_DRIVE_NAME"]
    folder_name = f"FOLDER-{run_id}"
    file_names = [f"NOTE-{run_id}-{i}.txt" for i in (1, 2, 3)]

    print(f"[info] run-id={run_id}")
    print(f"[info] target drive name={drive_name}")

    drive_id = resolve_drive_id(drive_name)
    print(f"[info] drive_id={drive_id}")

    folder_id = create_folder(drive_id, folder_name)
    print(f"[info] folder_id={folder_id} name={folder_name}")

    file_ids: list[str] = []
    for file_name in file_names:
        body = f"Run {run_id} note {file_name}\n".encode("utf-8")
        file_id = upload_file(drive_id, folder_id, file_name, body)
        print(f"[info] uploaded {file_name} -> {file_id}")
        file_ids.append(file_id)

    log_record = {"folder_id": folder_id, "file_ids": file_ids}
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log_record) + "\n", encoding="utf-8")
    print(f"[info] wrote log to {LOG_PATH}: {log_record}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"[error] {exc}", file=sys.stderr)
        sys.exit(1)