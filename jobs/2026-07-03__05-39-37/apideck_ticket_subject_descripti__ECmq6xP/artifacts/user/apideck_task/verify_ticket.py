#!/usr/bin/env python3
"""Verify the final state of ticket 269 by retrieving it via GET."""

import json
import os
import urllib.request
import urllib.error

API_KEY = os.environ["APIDECK_API_KEY"]
APP_ID = os.environ["APIDECK_APP_ID"]
CONSUMER_ID = os.environ["APIDECK_CONSUMER_ID"]
COLLECTION_ID = os.environ["APIDECK_ISSUE_TRACKING_COLLECTION_ID"]
SERVICE_ID = "github"

RUN_ID = open("/logs/artifacts/run-id").read().strip()
TICKET_ID = "269"

BASE_URL = "https://unify.apideck.com"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "x-apideck-app-id": APP_ID,
    "x-apideck-consumer-id": CONSUMER_ID,
    "x-apideck-service-id": SERVICE_ID,
    "Accept": "application/json",
}

# --- GET the ticket directly ---
get_url = (
    f"{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets/{TICKET_ID}"
)
req = urllib.request.Request(get_url, method="GET", headers=HEADERS)

try:
    with urllib.request.urlopen(req) as response:
        body = response.read().decode("utf-8")
        get_response = json.loads(body) if body else {}
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print(f"HTTP Error {e.code}: {body}")
    import sys
    sys.exit(1)

print(f"GET ticket response: {json.dumps(get_response, indent=2)}")

ticket_data = get_response.get("data", {})
subject = ticket_data.get("subject", "")
description = ticket_data.get("description", "")

print(f"\n--- Verification ---")
print(f"Ticket ID: {ticket_data.get('id')}")
print(f"Subject: {subject}")
print(f"Description: {description}")

expected_subject = f"[UPDATE-V2] {RUN_ID}"
expected_desc_fragment = "Revised draft v2"

subject_ok = expected_subject in subject
desc_ok = expected_desc_fragment in description

print(f"\nSubject contains '[UPDATE-V2] {RUN_ID}': {subject_ok}")
print(f"Description contains 'Revised draft v2': {desc_ok}")

if subject_ok and desc_ok:
    print("\n✅ Verification PASSED: Ticket is in the expected final state.")
else:
    print("\n❌ Verification FAILED: Ticket does not match expected state.")