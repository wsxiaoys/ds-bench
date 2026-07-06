#!/usr/bin/env bash
#
# upload_file.sh
#
# Direct file upload to Apideck File Storage using raw curl (no SDK).
#
#   1. Discovers the target REDACTED drive via the unified List Drives endpoint.
#   2. Uploads a single text file to the root of that drive through the
#      upload.apideck.com host, sending file metadata in the
#      `x-apideck-metadata` header and the raw file bytes in the body.
#   3. Writes the returned unified Apideck file id (data.id) to output.log.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration read from the environment
# ---------------------------------------------------------------------------
APP_ID="${APIDECK_APP_ID:?ERROR: APIDECK_APP_ID is required}"
API_KEY="${APIDECK_API_KEY:?ERROR: APIDECK_API_KEY is required}"
CONSUMER_ID="${APIDECK_CONSUMER_ID:?ERROR: APIDECK_CONSUMER_ID is required}"
DRIVE_NAME="${APIDECK_FILE_STORAGE_DRIVE_NAME:?ERROR: APIDECK_FILE_STORAGE_DRIVE_NAME is required}"
SERVICE_ID="onedrive"

PROJECT_DIR="/home/user/myproject"
OUTPUT_LOG="${PROJECT_DIR}/output.log"
RUN_ID_FILE="/logs/artifacts/run-id"

# ---------------------------------------------------------------------------
# Read run-id (strip any surrounding whitespace / newline)
# ---------------------------------------------------------------------------
if [ ! -f "$RUN_ID_FILE" ]; then
  echo "ERROR: run-id file not found at ${RUN_ID_FILE}" >&2
  exit 1
fi
RUN_ID="$(tr -d '[:space:]' < "$RUN_ID_FILE")"
if [ -z "$RUN_ID" ]; then
  echo "ERROR: run-id file is empty" >&2
  exit 1
fi

# File name uses the run-id verbatim (it already contains the 'zr' prefix).
FILE_NAME="apideck-curl-${RUN_ID}.txt"

# Exact required file body: single line, terminated by one newline (58 bytes).
FILE_BODY='Uploaded via Apideck File Storage direct upload curl test'

echo "Run id : ${RUN_ID}"
echo "File   : ${FILE_NAME}"
echo "Drive  : ${DRIVE_NAME} (service: ${SERVICE_ID})"

# ---------------------------------------------------------------------------
# Common Apideck headers shared by every request
# ---------------------------------------------------------------------------
COMMON_HEADERS=(
  -H "Authorization: Bearer ${API_KEY}"
  -H "x-apideck-app-id: ${APP_ID}"
  -H "x-apideck-consumer-id: ${CONSUMER_ID}"
  -H "x-apideck-service-id: ${SERVICE_ID}"
  -H "Accept: application/json"
)

# ---------------------------------------------------------------------------
# Step 1 — Discover the target drive via the unified List Drives endpoint
# ---------------------------------------------------------------------------
echo "---"
echo "Listing drives from unify.apideck.com ..."
DRIVES_RESPONSE=$(curl -sS -X GET "https://unify.apideck.com/file-storage/drives" \
  "${COMMON_HEADERS[@]}")

# Capture the id of the drive whose name matches APIDECK_FILE_STORAGE_DRIVE_NAME.
DRIVE_ID=$(printf '%s' "$DRIVES_RESPONSE" \
  | jq -r --arg name "$DRIVE_NAME" '.data[]? | select(.name == $name) | .id' \
  | head -n1)

if [ -z "$DRIVE_ID" ] || [ "$DRIVE_ID" = "null" ]; then
  echo "ERROR: no drive named '${DRIVE_NAME}' was found." >&2
  echo "----- drives response -----" >&2
  printf '%s\n' "$DRIVES_RESPONSE" >&2
  exit 1
fi
echo "Found drive '${DRIVE_NAME}' -> id: ${DRIVE_ID}"

# ---------------------------------------------------------------------------
# Step 2 — Prepare the exact file body on disk
# ---------------------------------------------------------------------------
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT
printf '%s\n' "$FILE_BODY" > "$TMP_FILE"

SIZE=$(wc -c < "$TMP_FILE" | tr -d '[:space:]')
if [ "$SIZE" != "58" ]; then
  echo "ERROR: file body is ${SIZE} bytes, expected 58." >&2
  exit 1
fi
echo "Prepared temp file (${SIZE} bytes): ${TMP_FILE}"

# ---------------------------------------------------------------------------
# Step 3 — Build the metadata JSON for the x-apideck-metadata header
# ---------------------------------------------------------------------------
# Use -c so the JSON is compact (single line) — HTTP headers cannot
# contain embedded newlines, which would otherwise break the request.
# The metadata schema only accepts the core fields; the file's MIME type
# is conveyed via the Content-Type HTTP header on the upload request.
METADATA=$(jq -cn \
  --arg name "$FILE_NAME" \
  --arg parent_folder_id "root" \
  --arg drive_id "$DRIVE_ID" \
  '{name: $name, parent_folder_id: $parent_folder_id, drive_id: $drive_id}')
echo "Metadata: ${METADATA}"

# ---------------------------------------------------------------------------
# Step 4 — Upload via the dedicated upload host (upload.apideck.com)
# ---------------------------------------------------------------------------
echo "---"
echo "Uploading to upload.apideck.com ..."
UPLOAD_RESPONSE=$(curl -sS -X POST "https://upload.apideck.com/file-storage/files" \
  "${COMMON_HEADERS[@]}" \
  -H "x-apideck-metadata: ${METADATA}" \
  -H "Content-Type: text/plain" \
  --data-binary "@${TMP_FILE}")

FILE_ID=$(printf '%s' "$UPLOAD_RESPONSE" | jq -r '.data.id // empty')

if [ -z "$FILE_ID" ]; then
  echo "ERROR: upload did not return a data.id." >&2
  echo "----- upload response -----" >&2
  printf '%s\n' "$UPLOAD_RESPONSE" >&2
  exit 1
fi

echo "Upload successful. Unified file id: ${FILE_ID}"

# ---------------------------------------------------------------------------
# Step 5 — Persist the unified file id to output.log (only non-empty line)
# ---------------------------------------------------------------------------
printf '%s\n' "$FILE_ID" > "$OUTPUT_LOG"
echo "Wrote file id to ${OUTPUT_LOG}"
echo "Done."