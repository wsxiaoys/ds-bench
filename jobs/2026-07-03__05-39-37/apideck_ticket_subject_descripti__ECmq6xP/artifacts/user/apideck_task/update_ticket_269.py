#!/usr/bin/env python3
"""
One-off script to update the already-created ticket 269 via PATCH
and write the output.log file.
"""

import json
import os
import sys
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
    "Content-Type": "application/json",
    "Accept": "application/json",
}

v2_subject = f"[UPDATE-V2] {RUN_ID}"
v2_description = "Revised draft v2"

update_payload = {
    "subject": v2_subject,
    "description": v2_description,
}
print(f"Update payload: {json.dumps(update_payload)}")

update_url = (
    f"{BASE_URL}/issue-tracking/collections/{COLLECTION_ID}/tickets/{TICKET_ID}"
)

data = json.dumps(update_payload).encode("utf-8")
req = urllib.request.Request(update_url, data=data, method="PATCH", headers=HEADERS)

try:
    with urllib.request.urlopen(req) as response:
        body = response.read().decode("utf-8")
        update_response = json.loads(body) if body else {}
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8")
    print(f"HTTP Error {e.code}: {body}")
    sys.exit(1)

print(f"Update response: {json.dumps(update_response)}")

updated_subject = update_response.get("data", {}).get("subject", "")
print(f"Updated subject: {updated_subject}")

# Write output.log
output_file = "/home/user/apideck_task/output.log"
v1_subject = f"[UPDATE-V1] {RUN_ID}"
with open(output_file, "w") as f:
    f.write(f"Ticket ID: {TICKET_ID}\n")
    f.write(f"Run ID: {RUN_ID}\n")
    f.write(f"V1 Subject: {v1_subject}\n")
    f.write(f"V2 Subject: {v2_subject}\n")
    f.write(f"V2 Description: {v2_description}\n")

print(f"Output log written to {output_file}")
with open(output_file, "r") as f:
    print(f.read())

print("=== Update complete ===")