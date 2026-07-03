#!/usr/bin/env python3
"""Apideck Issue Tracking: Ticket Subject & Description Update Workflow.

Reads credentials and run-id from the environment, creates a ticket using
the official Unified API POST endpoint, then updates it via PATCH, and
persists the resulting ticket identifier to output.log.
"""

import json
import os
import sys
from pathlib import Path

import urllib.request
import urllib.error

API_BASE = "https://unify.apideck.com"
SERVICE_ID = "github"

LOG_PATH = Path("/home/user/apideck_task/output.log")
RUN_ID_PATH = Path("/logs/artifacts/run-id")


def read_env() -> dict:
    required = [
        "APIDECK_API_KEY",
        "APIDECK_APP_ID",
        "APIDECK_CONSUMER_ID",
        "APIDECK_ISSUE_TRACKING_COLLECTION_ID",
    ]
    env = {key: os.environ.get(key) for key in required}
    missing = [k for k, v in env.items() if not v]
    if missing:
        raise SystemExit(f"Missing env vars: {missing}")
    return env


def read_run_id() -> str:
    if not RUN_ID_PATH.exists():
        raise SystemExit(f"Missing run-id file: {RUN_ID_PATH}")
    return RUN_ID_PATH.read_text().strip()


def http_request(method: str, url: str, headers: dict, body: dict | None) -> dict:
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read().decode("utf-8")
            return {"status": resp.status, "body": payload}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code} for {method} {url}: {payload}")


def main() -> None:
    env = read_env()
    run_id = read_run_id()
    collection_id = env["APIDECK_ISSUE_TRACKING_COLLECTION_ID"]

    headers = {
        "Authorization": f"Bearer {env['APIDECK_API_KEY']}",
        "x-apideck-app-id": env["APIDECK_APP_ID"],
        "x-apideck-consumer-id": env["APIDECK_CONSUMER_ID"],
        "x-apideck-service-id": SERVICE_ID,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    create_url = f"{API_BASE}/issue-tracking/collections/{collection_id}/tickets"
    initial_subject = f"[UPDATE-V1] {run_id}"
    initial_body = {
        "subject": initial_subject,
        "description": "Initial draft v1",
    }

    print(f"Creating ticket at {create_url}")
    create_resp = http_request("POST", create_url, headers, initial_body)
    print("Create response:", create_resp["status"])
    print(create_resp["body"])
    create_payload = json.loads(create_resp["body"])
    ticket = create_payload.get("data") or {}
    ticket_id = ticket.get("id")
    if not ticket_id:
        raise SystemExit("No ticket id returned from create")

    print(f"Created ticket id: {ticket_id}")

    update_subject = f"[UPDATE-V2] {run_id}"
    patch_url = f"{API_BASE}/issue-tracking/collections/{collection_id}/tickets/{ticket_id}"
    patch_body = {
        "subject": update_subject,
        "description": "Revised draft v2",
    }

    print(f"Patching ticket at {patch_url}")
    patch_resp = http_request("PATCH", patch_url, headers, patch_body)
    print("Patch response:", patch_resp["status"])
    print(patch_resp["body"])

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("w", encoding="utf-8") as fh:
        fh.write(f"Ticket ID: {ticket_id}\n")
    print(f"Wrote {LOG_PATH}")


if __name__ == "__main__":
    main()