#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Direct file upload to Apideck File Storage (REDACTED) via curl.
#
#   1. Reads env vars APIDECK_APP_ID, APIDECK_API_KEY, APIDECK_CONSUMER_ID,
#      APIDECK_FILE_STORAGE_DRIVE_NAME, plus the run id from
#      /logs/artifacts/run-id.
#   2. Calls GET https://unify.apideck.com/file-storage/drives to discover
#      the drive id whose name equals APIDECK_FILE_STORAGE_DRIVE_NAME.
#   3. POSTs the raw bytes of the file to
#      https://upload.apideck.com/file-storage/files with the metadata
#      shipped in the x-apideck-metadata header.
#   4. Writes the returned unified file id (data.id) to output.log.
# ---------------------------------------------------------------------------

set -euo pipefail

# --- Configuration from environment ---------------------------------------
: "${APIDECK_APP_ID:?APIDECK_APP_ID is required}"
: "${APIDECK_API_KEY:?APIDECK_API_KEY is required}"
: "${APIDECK_CONSUMER_ID:?APIDECK_CONSUMER_ID is required}"
: "${APIDECK_FILE_STORAGE_DRIVE_NAME:?APIDECK_FILE_STORAGE_DRIVE_NAME is required}"

SERVICE_ID="onedrive"
RUN_ID_FILE="/logs/artifacts/run-id"

if [[ ! -r "$RUN_ID_FILE" ]]; then
  echo "Run id file not found: ${RUN_ID_FILE}" >&2
  exit 1
fi
RUN_ID="$(tr -d '\r\n' < "${RUN_ID_FILE}")"
if [[ -z "${RUN_ID}" ]]; then
  echo "Run id file is empty: ${RUN_ID_FILE}" >&2
  exit 1
fi

# --- File to upload -------------------------------------------------------
FILE_NAME="apideck-curl-${RUN_ID}.txt"
# Exact ASCII body required: 57 chars + 1 trailing newline = 58 bytes.
FILE_BODY=$'Uploaded via Apideck File Storage direct upload curl test\n'

PROJECT_DIR="/home/user/myproject"
UPLOAD_PATH="${PROJECT_DIR}/${FILE_NAME}"
OUTPUT_LOG="${PROJECT_DIR}/output.log"

printf '%s' "${FILE_BODY}" > "${UPLOAD_PATH}"
ACTUAL_SIZE=$(wc -c < "${UPLOAD_PATH}")
EXPECTED_SIZE=58
if [[ "${ACTUAL_SIZE}" -ne "${EXPECTED_SIZE}" ]]; then
  echo "Unexpected file size: got ${ACTUAL_SIZE}, expected ${EXPECTED_SIZE}" >&2
  exit 1
fi

# --- 1. Discover the target drive ----------------------------------------
DRIVES_JSON=$(curl -sS --fail-with-body \
  -H "Authorization: Bearer ${APIDECK_API_KEY}" \
  -H "x-apideck-app-id: ${APIDECK_APP_ID}" \
  -H "x-apideck-consumer-id: ${APIDECK_CONSUMER_ID}" \
  -H "x-apideck-service-id: ${SERVICE_ID}" \
  -H "accept: application/json" \
  "https://unify.apideck.com/file-storage/drives")

DRIVE_ID=$(echo "${DRIVES_JSON}" \
  | jq -r --arg name "${APIDECK_FILE_STORAGE_DRIVE_NAME}" \
      '.data[] | select(.name == $name) | .id' \
  | head -n1)

if [[ -z "${DRIVE_ID}" || "${DRIVE_ID}" == "null" ]]; then
  echo "Could not find drive named '${APIDECK_FILE_STORAGE_DRIVE_NAME}'." >&2
  echo "Drives response:" >&2
  echo "${DRIVES_JSON}" >&2
  exit 1
fi

echo "Discovered drive id: ${DRIVE_ID}" >&2

# --- 2. Build metadata header --------------------------------------------
METADATA=$(jq -nc \
  --arg name     "${FILE_NAME}" \
  --arg folder   "root" \
  --arg drive_id "${DRIVE_ID}" \
  '{name: $name,
    parent_folder_id: $folder,
    drive_id: $drive_id}')

echo "Metadata header: ${METADATA}" >&2

# --- 3. Upload via upload.apideck.com ------------------------------------
UPLOAD_RESPONSE=$(curl -sS --fail-with-body \
  -X POST \
  -H "Authorization: Bearer ${APIDECK_API_KEY}" \
  -H "x-apideck-app-id: ${APIDECK_APP_ID}" \
  -H "x-apideck-consumer-id: ${APIDECK_CONSUMER_ID}" \
  -H "x-apideck-service-id: ${SERVICE_ID}" \
  -H "accept: application/json" \
  -H "Content-Type: text/plain" \
  -H "x-apideck-metadata: ${METADATA}" \
  --data-binary "@${UPLOAD_PATH}" \
  "https://upload.apideck.com/file-storage/files")

FILE_ID=$(echo "${UPLOAD_RESPONSE}" | jq -r '.data.id // empty')

if [[ -z "${FILE_ID}" ]]; then
  echo "Upload did not return a file id. Response:" >&2
  echo "${UPLOAD_RESPONSE}" >&2
  exit 1
fi

echo "Uploaded file id: ${FILE_ID}" >&2

# --- 4. Persist the unified file id --------------------------------------
printf '%s\n' "${FILE_ID}" > "${OUTPUT_LOG}"
echo "Wrote id to ${OUTPUT_LOG}" >&2