#!/usr/bin/env python3
"""Apideck Comment Edit & Delete Workflow.

This script:
  1. Reads run-id and credentials from environment/files.
  2. Creates a single ticket whose subject contains `[COMMENT-EDIT-DELETE]`
     and the current run-id.
  3. Adds four comments in order: A-<rid>, B-<rid>, C-<rid>, D-<rid>.
  4. Edits B-<rid> -> B-EDITED-<rid>.
  5. Deletes C-<rid>.
  6. Verifies that exactly three comments remain: A-<rid>, B-EDITED-<rid>,
     D-<rid>.
  7. Writes `Ticket ID: <ticket_id>` to /home/user/apideck_task/output.log.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = "https://unify.apideck.com"
RUN_ID_FILE = Path("/logs/artifacts/run-id")
LOG_FILE = Path("/home/user/apideck_task/output.log")

API_KEY = os.environ["APIDECK_API_KEY"]
APP_ID = os.environ["APIDECK_APP_ID"]
CONSUMER_ID = os.environ["APIDECK_CONSUMER_ID"]
COLLECTION_ID = os.environ["APIDECK_ISSUE_TRACKING_COLLECTION_ID"]
SERVICE_ID = "github"

RUN_ID = RUN_ID_FILE.read_text().strip()

COMMON_HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "x-apideck-app-id": APP_ID,
    "x-apideck-consumer-id": CONSUMER_ID,
    "x-apideck-service-id": SERVICE_ID,
    "Accept": "application/json",
    "Content-Type": "application/json",
}


def request(method: str, path: str, body: dict | None = None) -> dict:
    """Issue an HTTP request against the Apideck unified API and return JSON."""
    url = f"{BASE_URL}{path}"
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, method=method)
    for header, value in COMMON_HEADERS.items():
        req.add_header(header, value)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = resp.read().decode("utf-8")
            return json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        print(f"[ERROR] {method} {url} -> HTTP {exc.code}: {err_body}", file=sys.stderr)
        raise


def create_ticket() -> dict:
    subject = f"[COMMENT-EDIT-DELETE] {RUN_ID}"
    payload = {
        "subject": subject,
        "description": f"Comment edit/delete workflow for run {RUN_ID}.",
        "status": "open",
    }
    response = request(
        "POST",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets",
        payload,
    )
    ticket = response.get("data", {}) or {}
    print(f"[INFO] Created ticket id={ticket.get('id')} subject={ticket.get('subject')!r}")
    return ticket


def list_tickets() -> list[dict]:
    """Return all tickets in the collection, following pagination cursors."""
    tickets: list[dict] = []
    cursor: str | None = None
    while True:
        params: list[tuple[str, str]] = []
        if cursor:
            params.append(("cursor", cursor))
        qs = urllib.parse.urlencode(params)
        path = f"/issue-tracking/collections/{COLLECTION_ID}/tickets"
        if qs:
            path = f"{path}?{qs}"
        response = request("GET", path)
        tickets.extend(response.get("data", []) or [])
        next_cursor = (response.get("meta") or {}).get("cursors", {}).get("next")
        if not next_cursor:
            break
        cursor = next_cursor
    return tickets


def find_ticket_by_subject(run_id: str) -> dict | None:
    """Find a single ticket whose subject contains the run-id.

    Returns the ticket if exactly one match is found, else None.
    """
    matches = [t for t in list_tickets() if run_id in (t.get("subject") or "")]
    if len(matches) != 1:
        return None
    return matches[0]


def create_comment(ticket_id: str, body: str) -> dict:
    response = request(
        "POST",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments",
        {"body": body},
    )
    comment = response.get("data", {}) or {}
    print(f"[INFO] Added comment id={comment.get('id')}")
    return comment


def update_comment(ticket_id: str, comment_id: str, body: str) -> dict:
    response = request(
        "PATCH",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments/{comment_id}",
        {"body": body},
    )
    comment = response.get("data", {}) or {}
    print(f"[INFO] Updated comment id={comment.get('id') or comment_id}")
    return comment


def delete_comment(ticket_id: str, comment_id: str) -> None:
    response = request(
        "DELETE",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments/{comment_id}",
    )
    print(
        f"[INFO] Deleted comment id={comment_id} result={response.get('result') or response.get('status')}"
    )


def list_comments(ticket_id: str) -> list[dict]:
    """Return all comments on a ticket, following pagination cursors."""
    comments: list[dict] = []
    cursor: str | None = None
    while True:
        params: list[tuple[str, str]] = []
        if cursor:
            params.append(("cursor", cursor))
        qs = urllib.parse.urlencode(params)
        path = f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments"
        if qs:
            path = f"{path}?{qs}"
        response = request("GET", path)
        comments.extend(response.get("data", []) or [])
        next_cursor = (response.get("meta") or {}).get("cursors", {}).get("next")
        if not next_cursor:
            break
        cursor = next_cursor
    return comments


def main() -> int:
    print(f"[INFO] Run ID: {RUN_ID}")
    print(f"[INFO] Collection: {COLLECTION_ID}")

    # Step 1: create the ticket.
    ticket = create_ticket()
    ticket_id = ticket["id"]
    if not ticket_id:
        print("[ERROR] Ticket creation returned no id.", file=sys.stderr)
        return 1

    # Sanity: ensure exactly one ticket in the collection includes the run-id in its subject.
    found = find_ticket_by_subject(RUN_ID)
    if not found or found.get("id") != ticket_id:
        print(
            f"[ERROR] Expected exactly one ticket containing {RUN_ID!r}, found: {found}",
            file=sys.stderr,
        )
        return 1

    # Step 2: add the four comments sequentially and map body -> id by creation order.
    bodies = [f"A-{RUN_ID}", f"B-{RUN_ID}", f"C-{RUN_ID}", f"D-{RUN_ID}"]
    created: dict[str, str] = {}
    for body in bodies:
        response = create_comment(ticket_id, body)
        if not response.get("id"):
            print(f"[ERROR] Comment creation for {body!r} returned no id.", file=sys.stderr)
            return 1
        created[body] = response["id"]
    b_id = created[f"B-{RUN_ID}"]
    c_id = created[f"C-{RUN_ID}"]

    # Step 3: edit B- -> B-EDITED-.
    update_comment(ticket_id, b_id, f"B-EDITED-{RUN_ID}")

    # Step 4: delete C.
    delete_comment(ticket_id, c_id)

    # Step 5: verify final state.
    final_comments = list_comments(ticket_id)
    final_bodies = [c.get("body") for c in final_comments]
    expected = sorted([f"A-{RUN_ID}", f"B-EDITED-{RUN_ID}", f"D-{RUN_ID}"])
    actual = sorted(final_bodies)
    if actual != expected:
        print(
            f"[ERROR] Final comment state mismatch.\n  expected={expected}\n  actual={actual}",
            file=sys.stderr,
        )
        return 1

    print(f"[INFO] Final comment bodies verified: {sorted(final_bodies)}")

    # Step 6: persist the run-specific log file.
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(f"Ticket ID: {ticket_id}\n")
    print(f"[INFO] Wrote log to {LOG_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
