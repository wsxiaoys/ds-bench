#!/usr/bin/env python3
"""Apideck Issue Tracking: Comment Edit & Delete Workflow."""
import os
import sys
import json
import urllib.request
import urllib.error

BASE = "https://unify.apideck.com"

# --- Read configuration from environment / files -----------------------------
API_KEY = os.environ.get("APIDECK_API_KEY")
APP_ID = os.environ.get("APIDECK_APP_ID")
CONSUMER_ID = os.environ.get("APIDECK_CONSUMER_ID")
COLLECTION_ID = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")
SERVICE_ID = "github"  # per task description

try:
    with open("/logs/artifacts/run-id", "r") as f:
        RUN_ID = f.read().strip()
except FileNotFoundError:
    sys.exit("ERROR: /logs/artifacts/run-id not found")

missing = [k for k, v in {
    "APIDECK_API_KEY": API_KEY,
    "APIDECK_APP_ID": APP_ID,
    "APIDECK_CONSUMER_ID": CONSUMER_ID,
    "APIDECK_ISSUE_TRACKING_COLLECTION_ID": COLLECTION_ID,
}.items() if not v]
if missing:
    sys.exit("ERROR: missing env vars: " + ", ".join(missing))
if not RUN_ID:
    sys.exit("ERROR: run-id is empty")

LOG_PATH = "/home/user/apideck_task/output.log"
log_lines = []


def log(msg):
    print(msg)
    log_lines.append(msg)


def flush_log():
    with open(LOG_PATH, "w") as f:
        f.write("\n".join(log_lines) + "\n")


def headers():
    return {
        "Authorization": f"Bearer {API_KEY}",
        "x-apideck-app-id": APP_ID,
        "x-apideck-consumer-id": CONSUMER_ID,
        "x-apideck-service-id": SERVICE_ID,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def apideck_call(method, path, payload=None, query=None):
    url = BASE + path
    if query:
        from urllib.parse import urlencode
        url += ("?" + urlencode(query))
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=headers())
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        status = e.code
        print(f"HTTP {status} on {method} {path}", file=sys.stderr)
        print(body, file=sys.stderr)
        raise
    parsed = json.loads(body) if body else {}
    return status, parsed


# --- 1. Create the ticket ----------------------------------------------------
def create_ticket():
    subject = f"[COMMENT-EDIT-DELETE] {RUN_ID}"
    payload = {"subject": subject, "description": f"Comment edit/delete workflow run {RUN_ID}"}
    status, data = apideck_call(
        "POST",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets",
        payload=payload,
    )
    ticket = data.get("data", {})
    ticket_id = ticket.get("id")
    if not ticket_id:
        sys.exit(f"ERROR: no ticket id returned: {data}")
    log(f"Ticket ID: {ticket_id}")
    log(f"Created ticket subject: {subject}")
    return ticket_id


# --- 2. Add four comments ---------------------------------------------------
def add_comment(ticket_id, body):
    status, data = apideck_call(
        "POST",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments",
        payload={"body": body},
    )
    comment_id = data.get("data", {}).get("id")
    log(f"Added comment id={comment_id} body={body}")
    return comment_id


# --- 3. List all comments (paginated) --------------------------------------
def list_comments(ticket_id):
    comments = []
    cursor = None
    while True:
        query = {"limit": 100}
        if cursor:
            query["cursor"] = cursor
        status, data = apideck_call(
            "GET",
            f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments",
            query=query,
        )
        page = data.get("data", [])
        comments.extend(page)
        cursor = data.get("meta", {}).get("cursors", {}).get("next")
        if not cursor:
            break
    return comments


# --- 4. Update comment (PATCH) ---------------------------------------------
def update_comment(ticket_id, comment_id, body):
    status, data = apideck_call(
        "PATCH",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments/{comment_id}",
        payload={"body": body},
    )
    log(f"Updated comment id={comment_id} -> body={body}")


# --- 5. Delete comment ------------------------------------------------------
def delete_comment(ticket_id, comment_id):
    status, data = apideck_call(
        "DELETE",
        f"/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}/comments/{comment_id}",
    )
    log(f"Deleted comment id={comment_id}")


def find_comment_by_body(comments, body):
    for c in comments:
        if c.get("body") == body:
            return c
    return None


def main():
    log(f"Run ID: {RUN_ID}")
    log(f"Collection ID: {COLLECTION_ID}")
    log(f"Service ID: {SERVICE_ID}")

    ticket_id = create_ticket()

    bodies = [f"A-{RUN_ID}", f"B-{RUN_ID}", f"C-{RUN_ID}", f"D-{RUN_ID}"]
    for b in bodies:
        add_comment(ticket_id, b)

    # Verify all four comments exist
    comments = list_comments(ticket_id)
    log(f"Comments after creation: {len(comments)}")

    # Edit B-<run-id> -> B-EDITED-<run-id>
    b_target = f"B-{RUN_ID}"
    b_comment = find_comment_by_body(comments, b_target)
    if not b_comment:
        sys.exit(f"ERROR: comment '{b_target}' not found after creation")
    update_comment(ticket_id, b_comment["id"], f"B-EDITED-{RUN_ID}")

    # Delete C-<run-id>
    c_target = f"C-{RUN_ID}"
    c_comment = find_comment_by_body(comments, c_target)
    if not c_comment:
        sys.exit(f"ERROR: comment '{c_target}' not found after creation")
    delete_comment(ticket_id, c_comment["id"])

    # Verify final state
    final_comments = list_comments(ticket_id)
    final_bodies = sorted([c.get("body") for c in final_comments])
    expected = sorted([f"A-{RUN_ID}", f"B-EDITED-{RUN_ID}", f"D-{RUN_ID}"])
    log(f"Final comment count: {len(final_comments)}")
    log(f"Final comment bodies: {final_bodies}")
    log(f"Expected comment bodies: {expected}")

    if final_bodies != expected:
        sys.exit("ERROR: final comment state does not match expected!")
    log("SUCCESS: final comment state matches expected configuration.")
    flush_log()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"FAILURE: {e}")
        flush_log()
        raise