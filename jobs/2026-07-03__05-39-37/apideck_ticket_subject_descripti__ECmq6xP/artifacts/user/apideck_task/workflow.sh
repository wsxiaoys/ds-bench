#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Apideck Issue Tracking: Ticket Subject & Description Update Workflow
# ---------------------------------------------------------------------------
# This script:
#   1. Reads credentials, collection id, and run-id from env / file.
#   2. Creates a ticket with subject containing [UPDATE-V1] and the run-id.
#   3. Updates the ticket via PATCH so subject contains [UPDATE-V2] + run-id
#      and description contains "Revised draft v2".
#   4. Records the resulting ticket id to output.log.
# ---------------------------------------------------------------------------

# --- Read configuration from environment variables ---
API_KEY="${APIDECK_API_KEY:?APIDECK_API_KEY is required}"
APP_ID="${APIDECK_APP_ID:?APIDECK_APP_ID is required}"
CONSUMER_ID="${APIDECK_CONSUMER_ID:?APIDECK_CONSUMER_ID is required}"
COLLECTION_ID="${APIDECK_ISSUE_TRACKING_COLLECTION_ID:?APIDECK_ISSUE_TRACKING_COLLECTION_ID is required}"
SERVICE_ID="github"

# --- Read run-id from the artifacts file ---
RUN_ID="$(cat /logs/artifacts/run-id | tr -d '[:space:]')"
echo "Run ID: ${RUN_ID}"

# --- Common headers ---
AUTH_HEADER="Authorization: Bearer ${API_KEY}"
APP_HEADER="x-apideck-app-id: ${APP_ID}"
CONSUMER_HEADER="x-apideck-consumer-id: ${CONSUMER_ID}"
SERVICE_HEADER="x-apideck-service-id: ${SERVICE_ID}"
CONTENT_HEADER="Content-Type: application/json"
ACCEPT_HEADER="Accept: application/json"

BASE_URL="https://unify.apideck.com"

# --- Step 1: Create the ticket (POST) ---
echo "=== Step 1: Creating ticket with [UPDATE-V1] ==="

V1_SUBJECT="[UPDATE-V1] ${RUN_ID}"
V1_DESCRIPTION="Initial draft for run ${RUN_ID}"

CREATE_PAYLOAD=$(jq -n \
  --arg subject "$V1_SUBJECT" \
  --arg description "$V1_DESCRIPTION" \
  '{subject: $subject, description: $description}')

echo "Create payload: ${CREATE_PAYLOAD}"

CREATE_RESPONSE=$(curl -s -X POST \
  "${BASE_URL}/issue-tracking/collections/${COLLECTION_ID}/tickets" \
  -H "${AUTH_HEADER}" \
  -H "${APP_HEADER}" \
  -H "${CONSUMER_HEADER}" \
  -H "${SERVICE_HEADER}" \
  -H "${CONTENT_HEADER}" \
  -H "${ACCEPT_HEADER}" \
  -d "${CREATE_PAYLOAD}")

echo "Create response: ${CREATE_RESPONSE}"

# Extract the ticket id from the response
TICKET_ID=$(echo "${CREATE_RESPONSE}" | jq -r '.data.id')

if [ -z "${TICKET_ID}" ] || [ "${TICKET_ID}" = "null" ]; then
  echo "ERROR: Failed to extract ticket id from create response"
  exit 1
fi

echo "Created ticket id: ${TICKET_ID}"

# --- Step 2: Update the ticket (PATCH) ---
echo "=== Step 2: Updating ticket with [UPDATE-V2] ==="

V2_SUBJECT="[UPDATE-V2] ${RUN_ID}"
V2_DESCRIPTION="Revised draft v2"

UPDATE_PAYLOAD=$(jq -n \
  --arg id "$TICKET_ID" \
  --arg subject "$V2_SUBJECT" \
  --arg description "$V2_DESCRIPTION" \
  '{id: $id, subject: $subject, description: $description}')

echo "Update payload: ${UPDATE_PAYLOAD}"

UPDATE_RESPONSE=$(curl -s -X PATCH \
  "${BASE_URL}/issue-tracking/collections/${COLLECTION_ID}/tickets/${TICKET_ID}" \
  -H "${AUTH_HEADER}" \
  -H "${APP_HEADER}" \
  -H "${CONSUMER_HEADER}" \
  -H "${SERVICE_HEADER}" \
  -H "${CONTENT_HEADER}" \
  -H "${ACCEPT_HEADER}" \
  -d "${UPDATE_PAYLOAD}")

echo "Update response: ${UPDATE_RESPONSE}"

# Verify the update response contains expected fields
UPDATED_SUBJECT=$(echo "${UPDATE_RESPONSE}" | jq -r '.data.subject // empty')
echo "Updated subject: ${UPDATED_SUBJECT}"

# --- Step 3: Record the ticket id to output.log ---
echo "=== Step 3: Recording ticket id to output.log ==="

OUTPUT_FILE="/home/user/apideck_task/output.log"
echo "Ticket ID: ${TICKET_ID}" > "${OUTPUT_FILE}"
echo "Run ID: ${RUN_ID}" >> "${OUTPUT_FILE}"
echo "V1 Subject: ${V1_SUBJECT}" >> "${OUTPUT_FILE}"
echo "V2 Subject: ${V2_SUBJECT}" >> "${OUTPUT_FILE}"
echo "V2 Description: ${V2_DESCRIPTION}" >> "${OUTPUT_FILE}"

echo "Output log written to ${OUTPUT_FILE}"
cat "${OUTPUT_FILE}"

echo "=== Workflow complete ==="