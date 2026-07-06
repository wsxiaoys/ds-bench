#!/usr/bin/env python3
"""Upload 7 files to the REDACTED drive root and aggregate their IDs using cursor pagination."""

import json
import os
import sys
import time
from pathlib import Path

import requests

APP_ID = os.environ["APIDECK_APP_ID"]
API_KEY = os.environ["APIDECK_API_KEY"]
CONSUMER_ID = os.environ["APIDECK_CONSUMER_ID"]
DRIVE_NAME = os.environ["APIDECK_FILE_STORAGE_DRIVE_NAME"]
RUN_ID = Path("/logs/artifacts/run-id").read_text().strip()

SERVICE_ID = "onedrive"
PREFIX = f"AGG-{RUN_ID}-"
NUM_FILES = 7
PAGE_SIZE = 3

UNIFY_BASE = "https://unify.apideck.com"
UPLOAD_BASE = "https://upload.apideck.com"
OUTPUT_LOG = "/home/user/apideck_task/output.log"


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def auth_headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "x-apideck-app-id": APP_ID,
        "x-apideck-consumer-id": CONSUMER_ID,
    }


def list_drives():
    url = f"{UNIFY_BASE}/file-storage/drives"
    headers = {**auth_headers(), "x-apideck-service-id": SERVICE_ID}
    response = requests.get(url, headers=headers, params={"limit": 200}, timeout=60)
    response.raise_for_status()
    return response.json()


def upload_file(name, content_bytes, parent_folder_id="root"):
    url = f"{UPLOAD_BASE}/file-storage/files"
    metadata = {"name": name, "parent_folder_id": parent_folder_id}
    headers = {
        **auth_headers(),
        "x-apideck-service-id": SERVICE_ID,
        "x-apideck-metadata": json.dumps(metadata),
        "Content-Type": "text/plain",
    }
    response = requests.post(url, headers=headers, data=content_bytes, timeout=120)
    if response.status_code >= 400:
        log(f"Upload failed for {name}: {response.status_code} {response.text}")
        response.raise_for_status()
    return response.json()


def list_files(cursor=None, limit=PAGE_SIZE):
    url = f"{UNIFY_BASE}/file-storage/files"
    headers = {**auth_headers(), "x-apideck-service-id": SERVICE_ID}
    params = {"limit": limit}
    if cursor:
        params["cursor"] = cursor
    response = requests.get(url, headers=headers, params=params, timeout=60)
    response.raise_for_status()
    return response.json()


def resolve_drive_id(drives_payload):
    data = drives_payload.get("data", []) or []
    for drive in data:
        if drive.get("name") == DRIVE_NAME:
            return drive.get("id")
    # Fall back: if a single drive is returned, use it
    if len(data) == 1:
        return data[0].get("id")
    return None


def main():
    log(f"Run ID: {RUN_ID}")
    log(f"Drive name: {DRIVE_NAME}")
    log(f"Prefix: {PREFIX}")

    # Resolve the REDACTED drive ID
    drives_payload = list_drives()
    drive_id = resolve_drive_id(drives_payload)
    log(f"List drives -> count={len(drives_payload.get('data', []) or [])}, drive_id={drive_id}")
    log(f"Drives payload: {json.dumps(drives_payload)[:500]}")

    # Upload 7 files sequentially
    uploaded_ids = []
    for i in range(1, NUM_FILES + 1):
        name = f"{PREFIX}{i}.txt"
        body = f"Aggregation fixture {name}\n".encode("utf-8")
        try:
            result = upload_file(name, body)
            log(f"Uploaded {name}: status={result.get('status_code')} result={json.dumps(result)[:300]}")
            new_id = (result.get("data") or {}).get("id")
            if new_id:
                uploaded_ids.append(new_id)
        except requests.HTTPError as e:
            log(f"Error uploading {name}: {e}")
            # small backoff before retry
            time.sleep(2)
            result = upload_file(name, body)
            log(f"Retry uploaded {name}: {json.dumps(result)[:300]}")
            new_id = (result.get("data") or {}).get("id")
            if new_id:
                uploaded_ids.append(new_id)

    log(f"Uploaded IDs: {uploaded_ids}")

    # Walk file listing using cursor pagination with limit=3
    ids = []
    cursor = None
    page = 0
    while True:
        page += 1
        payload = list_files(cursor=cursor, limit=PAGE_SIZE)
        data = payload.get("data", []) or []
        names_on_page = [item.get("name") for item in data]
        for item in data:
            name = item.get("name") or ""
            if name.startswith(PREFIX):
                ids.append(item.get("id"))
        meta = payload.get("meta") or {}
        cursors = meta.get("cursors") or {}
        next_cursor = cursors.get("next")
        log(f"Page {page}: items_on_page={meta.get('items_on_page')}, names={names_on_page}, next_cursor_present={bool(next_cursor)}")
        if not next_cursor:
            break
        cursor = next_cursor

    # Preserve discovery order, but ensure uniqueness
    seen = set()
    unique_ids = []
    for fid in ids:
        if fid not in seen:
            seen.add(fid)
            unique_ids.append(fid)

    summary = {"count": len(unique_ids), "ids": unique_ids}
    Path(OUTPUT_LOG).write_text(json.dumps(summary))
    log(f"Wrote summary to {OUTPUT_LOG}: {summary}")


if __name__ == "__main__":
    main()