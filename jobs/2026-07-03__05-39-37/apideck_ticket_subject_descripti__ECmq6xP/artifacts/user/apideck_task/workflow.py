#!/usr/bin/env python3
"""
Apideck Issue Tracking: Ticket Subject & Description Update Workflow

This script:
  1. Reads credentials, collection id, and run-id from env / file.
  2. Creates a ticket with subject containing [UPDATE-V1] and the run-id.
  3. Updates the ticket via PATCH so subject contains [UPDATE-V2] + run-id
     and description contains "Revised draft v2".
  4. Records the resulting ticket id to output.log.
"""

import json
import os
import sys
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Read configuration from environment variables
# ---------------------------------------------------------------------------
API_KEY = os.environ.get("APIDECK_API_KEY")
APP_ID = os.environ.get("APIDECK_APP_ID")
CONSUMER_ID = os.environ.get("APIDECK_CONSUMER_ID")
COLLECTION_ID = os.environ.get("APIDECK_ISSUE_TRACKING_COLLECTION_ID")
SERVICE_ID = "github"

if not all([API_KEY, APP_ID, CONSUMER_ID, COLLECTION_ID]):
    missing = [
        name
        for name, val in [
            ("APIDECK_API_KEY", API_KEY),
            ("APIDECK_APP_ID", APP_ID),
            ("APIDECK_CONSUMER_ID", CONSUMER_ID),
            ("APIDECK_ISSUE_TRACKING_COLLECTION_ID", COLLECTION_ID),
        ]
        if not val
    ]
    print(f"ERROR: Missing environment variables: {', '.join(missing)}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Read run-id from the artifacts file
# ---------------------------------------------------------------------------
RUN_ID = ""
try:
    with open("/logs/artifacts/run-id", "r") as f:
        RUN_ID = f.read().strip()
except FileNotFoundError:
    print("ERROR: /logs/artifacts/run-id not found")
    sys.exit(1)

print(f"Run ID: {RUN_ID}")

# ---------------------------------------------------------------------------
# Common headers and base URL
# ---------------------------------------------------------------------------
BASE_URL = "https://unify.apideck.com"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "x-apideck-app-id": APP_ID,
    "x-apideck-consumer-id": CONSUMER_ID,
    "x-apideck-service-id": SERVICE_ID,
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def make_request(method, url, payload=None):
    """Make an HTTP request and return the parsed JSON response."""
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(url, data=data, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP Error {e.code}: {body}")
        raise
    except urllib.error.URLError as e:
        print(f"URL Error: {e}")
        raise


# ---------------------------------------------------------------------------
# Step 1: Create the ticket (POST)
# ---------------------------------------------------------------------------
print("=== Step 1: Creating ticket with [UPDATE-V1] ===")

v1_subject = f"[UPDATE-V1] {RUN_ID}"
v1_description = f"Initial draft for run {RUN_ID}"

create_payload = {"subject": v1_subject, "description": v1_description}
print(f"Create payload: {json.dumps(create_payload)}")

create_url = f"{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets"
create_response = make_request("POST", create_url, create_payload)

print(f"Create response: {json.dumps(create_response)}")

ticket_id = create_response.get("data", {}).get("id")

if not ticket_id:
    print("ERROR: Failed to extract ticket id from create response")
    sys.exit(1)

print(f"Created ticket id: {ticket_id}")

# ---------------------------------------------------------------------------
# Step 2: Update the ticket (PATCH)
# ---------------------------------------------------------------------------
print("=== Step 2: Updating ticket with [UPDATE-V2] ===")

v2_subject = f"[UPDATE-V2] {RUN_ID}"
v2_description = "Revised draft v2"

# The Apideck schema validation rejects 'id' as an additional property in the
# PATCH body — the ticket id is already in the URL path. We send only the
# fields that GitHub honors: subject and description.
update_payload = {
    "subject": v2_subject,
    "description": v2_description,
}
print(f"Update payload: {json.dumps(update_payload)}")

update_url = (
    f"{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets/{ticket_id}"
)
update_response = make_request("PATCH", update_url, update_payload)

print(f"Update response: {json.dumps(update_response)}")

updated_subject = update_response.get("data", {}).get("subject", "")
print(f"Updated subject: {updated_subject}")

# ---------------------------------------------------------------------------
# Step 3: Record the ticket id to output.log
# ---------------------------------------------------------------------------
print("=== Step 3: Recording ticket id to output.log ===")

output_file = "/home/user/apideck_task/output.log"
with open(output_file, "w") as f:
    f.write(f"Ticket ID: {ticket_id}\n")
    f.write(f"Run ID: {RUN_ID}\n")
    f.write(f"V1 Subject: {v1_subject}\n")
    f.write(f"V2 Subject: {v2_subject}\n")
    f.write(f"V2 Description: {v2_description}\n")

print(f"Output log written to {output_file}")
with open(output_file, "r") as f:
    print(f.read())

print("=== Workflow complete ===")