#!/usr/bin/env python3
"""
Cross-API Ticket / File Summary

Performs two real Apideck Unify side effects for the current run:
  1. Uploads exactly three small text files to the REDACTED drive root.
  2. Creates exactly one GitHub Issue Tracking ticket whose subject contains
     the artifact path and the [FILE-INDEX] marker, and whose description is
     the newline-joined list of the three uploaded files' Apideck file ids,
     sorted ascending.
"""

import json
import os
import sys
import urllib.request
import urllib.error

# --- Configuration from environment ------------------------------------------
API_KEY = os.environ["APIDECK_API_KEY"]
APP_ID = os.environ["APIDECK_APP_ID"]
CONSUMER_ID = os.environ["APIDECK_CONSUMER_ID"]
COLLECTION_ID = os.environ["APIDECK_ISSUE_TRACKING_COLLECTION_ID"]

RUN_ID = open("/logs/artifacts/run-id").read().strip()
ARTIFACT_PATH_LITERAL = "/logs/artifacts/run-id"
ARTIFACT_PATH_RESOLVED = "/logs/artifacts/" + RUN_ID

UPLOAD_BASE = "https://upload.apideck.com"
UNIFY_BASE = "https://unify.apideck.com"

FILE_STORAGE_SERVICE = "onedrive"
ISSUE_TRACKING_SERVICE = "github"

FILE_SUFFIXES = ["A", "B", "C"]


def common_headers(service_id):
    return {
        "Authorization": "Bearer " + API_KEY,
        "x-apideck-app-id": APP_ID,
        "x-apideck-consumer-id": CONSUMER_ID,
        "x-apideck-service-id": service_id,
    }


def upload_file(name, content):
    """Upload a single file to the REDACTED drive root via direct upload."""
    url = UPLOAD_BASE + "/file-storage/files"
    headers = common_headers(FILE_STORAGE_SERVICE)
    headers["Content-Type"] = "text/plain"
    headers["x-apideck-metadata"] = json.dumps(
        {"name": name, "parent_folder_id": "root"}
    )
    data = content.encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        status = e.code
        print("UPLOAD ERROR %s for %s: %s" % (status, name, body))
        sys.exit(1)
    result = json.loads(body)
    file_id = result["data"]["id"]
    print("Uploaded %s -> id=%s (HTTP %s)" % (name, file_id, status))
    return file_id


def create_ticket(subject, description):
    """Create one Issue Tracking ticket in the GitHub collection."""
    url = (
        UNIFY_BASE
        + "/issue-tracking/collections/"
        + COLLECTION_ID
        + "/tickets"
    )
    headers = common_headers(ISSUE_TRACKING_SERVICE)
    headers["Content-Type"] = "application/json"
    payload = {
        "subject": subject,
        "description": description,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        status = e.code
        print("TICKET ERROR %s: %s" % (status, body))
        sys.exit(1)
    result = json.loads(body)
    ticket_id = result["data"]["id"]
    print("Created ticket id=%s (HTTP %s)" % (ticket_id, status))
    return result


def main():
    print("Run ID: %s" % RUN_ID)
    print("Collection ID: %s" % COLLECTION_ID)
    print()

    # --- Step 1: Upload three files to REDACTED drive root -------------------
    file_ids = []
    for suffix in FILE_SUFFIXES:
        fname = "REPORT-%s-%s.txt" % (RUN_ID, suffix)
        content = "Report %s for run %s\n" % (suffix, RUN_ID)
        fid = upload_file(fname, content)
        file_ids.append(fid)

    print()
    print("All file ids (unsorted): %s" % file_ids)

    # --- Step 2: Sort file ids ascending -------------------------------------
    sorted_ids = sorted(file_ids)
    print("Sorted file ids: %s" % sorted_ids)
    description = "\n".join(sorted_ids)

    # --- Step 3: Create the GitHub issue tracking ticket ---------------------
    # Subject contains both the artifact path and the [FILE-INDEX] marker.
    # Include both the literal path and the resolved path for robustness.
    subject = (
        "Cross-API File Index %s %s [FILE-INDEX]"
        % (ARTIFACT_PATH_LITERAL, ARTIFACT_PATH_RESOLVED)
    )
    print()
    print("Ticket subject: %s" % subject)
    print("Ticket description:")
    print(description)
    print()

    result = create_ticket(subject, description)
    print()
    print("=== RESULT ===")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()