#!/usr/bin/env python3
"""Cross-API REDACTED + GitHub ticket sync (Apideck Unify).

Side effects:

1. Upload exactly three small text files to the REDACTED drive root
   (service id ``onedrive``), named
     - REPORT-<run-id>-A.txt
     - REPORT-<run-id>-B.txt
     - REPORT-<run-id>-C.txt

2. Create exactly one Issue Tracking ticket (service id ``github``,
   collection ``$APIDECK_ISSUE_TRACKING_COLLECTION_ID``) whose subject
   contains BOTH ``/logs/artifacts/run-id`` and the literal marker
   ``[FILE-INDEX]``, and whose description is the newline-joined list of
   the three uploaded files' Apideck file IDs, sorted ascending. The
   description contains only those three id lines.
"""

from __future__ import annotations

import os
import sys
from typing import List

import httpx

RUN_ID_PATH = "/logs/artifacts/run-id"


def fail(msg: str, code: int = 1) -> "None":
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def upload_file(
    *,
    api_key: str,
    consumer_id: str,
    app_id: str,
    service_id: str,
    name: str,
    body: bytes,
) -> str:
    """Direct upload to upload.apideck.com as documented in the file
    upload guide. Returns the Apideck file id."""
    metadata = '{"name": "' + name + '", "parent_folder_id": "root"}'
    response = httpx.post(
        "https://upload.apideck.com/file-storage/files",
        content=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "text/plain",
            "x-apideck-app-id": app_id,
            "x-apideck-consumer-id": consumer_id,
            "x-apideck-metadata": metadata,
            "x-apideck-service-id": service_id,
        },
        timeout=30,
    )
    if response.status_code not in (200, 201):
        fail(
            f"upload of {name!r} failed: HTTP {response.status_code} "
            f"{response.text[:300]}"
        )
    data = response.json().get("data") or {}
    file_id = data.get("id")
    if not file_id:
        fail(f"upload of {name!r} returned no file id: {response.text[:300]}")
    return file_id


def create_ticket(
    *,
    api_key: str,
    consumer_id: str,
    app_id: str,
    service_id: str,
    collection_id: str,
    subject: str,
    description: str,
) -> dict:
    response = httpx.post(
        f"https://unify.apideck.com/issue-tracking/collections/{collection_id}/tickets",
        json={"subject": subject, "description": description},
        headers={
            "Authorization": f"Bearer {api_key}",
            "x-apideck-app-id": app_id,
            "x-apideck-consumer-id": consumer_id,
            "x-apideck-service-id": service_id,
        },
        timeout=30,
    )
    if response.status_code not in (200, 201):
        fail(
            f"ticket create failed: HTTP {response.status_code} "
            f"{response.text[:300]}"
        )
    return response.json()


def main() -> int:
    api_key = os.environ.get("APIDECK_API_KEY", "")
    consumer_id = os.environ.get("APIDECK_CONSUMER_ID", "")
    app_id = os.environ.get("APIDECK_APP_ID", "")
    collection_id = os.environ.get(
        "APIDECK_ISSUE_TRACKING_COLLECTION_ID", ""
    )

    try:
        run_id = open(RUN_ID_PATH).read().strip()
    except OSError as exc:
        fail(f"cannot read {RUN_ID_PATH}: {exc}")

    missing = [
        n
        for n, v in {
            "APIDECK_API_KEY": api_key,
            "APIDECK_CONSUMER_ID": consumer_id,
            "APIDECK_APP_ID": app_id,
            "APIDECK_ISSUE_TRACKING_COLLECTION_ID": collection_id,
            "run-id": run_id,
        }.items()
        if not v
    ]
    if missing:
        fail(f"missing environment values: {missing}")

    # Exactly three files with case-sensitive names.
    suffixes = ["A", "B", "C"]
    filenames = [f"REPORT-{run_id}-{s}.txt" for s in suffixes]
    assert len(filenames) == 3 and len(set(filenames)) == 3

    # ------------------------------------------------------------------
    # Step 1 — upload three files to the REDACTED drive root.
    # ------------------------------------------------------------------
    file_ids: List[str] = []
    for name in filenames:
        body = f"REDACTED report for run {run_id} ({name})\n".encode("utf-8")
        file_id = upload_file(
            api_key=api_key,
            consumer_id=consumer_id,
            app_id=app_id,
            service_id="onedrive",
            name=name,
            body=body,
        )
        file_ids.append(file_id)
        print(f"[upload] {name}: id={file_id}")

    assert len(file_ids) == 3, "must upload exactly three files"

    sorted_ids = sorted(file_ids)
    description = "\n".join(sorted_ids) + "\n"
    # Sanity: description must be only those three id lines.
    assert description.strip().splitlines() == sorted_ids, (
        "description must contain exactly the three sorted file id lines"
    )

    # ------------------------------------------------------------------
    # Step 2 — create exactly one Issue Tracking ticket.
    # ------------------------------------------------------------------
    subject = (
        f"[FILE-INDEX] REDACTED report bundle for /logs/artifacts/run-id "
        f"(run {run_id})"
    )
    assert "/logs/artifacts/run-id" in subject, (
        "subject must contain /logs/artifacts/run-id"
    )
    assert "[FILE-INDEX]" in subject, (
        "subject must contain the [FILE-INDEX] marker"
    )

    ticket = create_ticket(
        api_key=api_key,
        consumer_id=consumer_id,
        app_id=app_id,
        service_id="github",
        collection_id=collection_id,
        subject=subject,
        description=description,
    )
    ticket_id = (ticket.get("data") or {}).get("id")
    print(
        f"[ticket] created id={ticket_id} subject={subject!r} "
        f"description={description!r}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
