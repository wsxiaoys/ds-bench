#!/usr/bin/env python3
"""Verify the two Apideck side effects were performed correctly."""

import json
import os
import urllib.request
import urllib.error

API_KEY = os.environ["APIDECK_API_KEY"]
APP_ID = os.environ["APIDECK_APP_ID"]
CONSUMER_ID = os.environ["APIDECK_CONSUMER_ID"]
COLLECTION_ID = os.environ["APIDECK_ISSUE_TRACKING_COLLECTION_ID"]
RUN_ID = open("/logs/artifacts/run-id").read().strip()

UNIFY_BASE = "https://unify.apideck.com"


def get(url, service_id):
    headers = {
        "Authorization": "Bearer " + API_KEY,
        "x-apideck-app-id": APP_ID,
        "x-apideck-consumer-id": CONSUMER_ID,
        "x-apideck-service-id": service_id,
    }
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


# --- Verify files at REDACTED root -----------------------------------------
print("=== Verifying uploaded files (REDACTED) ===")
expected_names = ["REPORT-%s-%s.txt" % (RUN_ID, s) for s in ["A", "B", "C"]]
found = {}
cursor = None
while True:
    url = UNIFY_BASE + "/file-storage/files?limit=200"
    if cursor:
        url += "&cursor=" + cursor
    res = get(url, "onedrive")
    for f in res.get("data", []):
        if f.get("type") == "file" and f.get("name") in expected_names:
            found[f["name"]] = f
    cursor = res.get("meta", {}).get("cursors", {}).get("next")
    if not cursor:
        break

for name in expected_names:
    if name in found:
        f = found[name]
        parent = f.get("parent_folders", [])
        print("OK  %s  id=%s  parent=%s" % (name, f["id"], parent))
    else:
        print("MISSING  %s" % name)

# --- Verify the ticket ------------------------------------------------------
print()
print("=== Verifying GitHub issue tracking ticket ===")
ticket_id = "268"
url = (
    UNIFY_BASE
    + "/issue-tracking/collections/"
    + COLLECTION_ID
    + "/tickets/"
    + ticket_id
)
try:
    res = get(url, "github")
    ticket = res["data"]
    print("Ticket id: %s" % ticket.get("id"))
    print("Subject:   %s" % ticket.get("subject"))
    print("Description:")
    print(ticket.get("description"))
    print()
    subj = ticket.get("subject", "") or ""
    desc = ticket.get("description", "") or ""
    print("Subject contains '/logs/artifacts/run-id':", "/logs/artifacts/run-id" in subj)
    print("Subject contains '[FILE-INDEX]':", "[FILE-INDEX]" in subj)
    desc_lines = [l for l in desc.split("\n") if l.strip()]
    print("Description line count:", len(desc_lines))
    print("Description lines sorted ascending:", desc_lines == sorted(desc_lines))
except urllib.error.HTTPError as e:
    print("ERROR fetching ticket: %s %s" % (e.code, e.read().decode()))