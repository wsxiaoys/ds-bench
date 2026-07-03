#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
RUN_ID="$(tr -d '\r\n' < /logs/artifacts/run-id)"
API_KEY="$(printf '%s' "$APIDECK_API_KEY" | tr -d '\r\n')"
APP_ID="$(printf '%s' "$APIDECK_APP_ID" | tr -d '\r\n')"
CONSUMER_ID="$(printf '%s' "$APIDECK_CONSUMER_ID" | tr -d '\r\n')"
DRIVE_NAME="$(printf '%s' "$APIDECK_FILE_STORAGE_DRIVE_NAME" | tr -d '\r\n')"

UNIFY_HOST="https://unify.apideck.com"
UPLOAD_HOST="https://upload.apideck.com"

AUTH_HEADER="Authorization: Bearer ${API_KEY}"
APP_HEADER="x-apideck-app-id: ${APP_ID}"
CONSUMER_HEADER="x-apideck-consumer-id: ${CONSUMER_ID}"
SERVICE_HEADER="x-apideck-service-id: onedrive"
COMMON_HEADERS=(-H "$AUTH_HEADER" -H "$APP_HEADER" -H "$CONSUMER_HEADER" -H "$SERVICE_HEADER" -H "accept: application/json")

echo "run-id: ${RUN_ID}"
echo "drive name: ${DRIVE_NAME}"

# --- Step 1: Resolve drive id ---
DRIVES_RESPONSE=$(curl -s "${COMMON_HEADERS[@]}" "${UNIFY_HOST}/file-storage/drives")

DRIVE_ID=$(printf '%s' "$DRIVES_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
drive_name = '''${DRIVE_NAME}'''
for d in data.get('data', []):
    if d.get('name') == drive_name:
        print(d.get('id'))
        break
")

if [ -z "$DRIVE_ID" ]; then
  echo "ERROR: could not resolve drive id for name '${DRIVE_NAME}'"
  echo "Drives response: $DRIVES_RESPONSE"
  exit 1
fi
echo "drive_id: ${DRIVE_ID}"

# --- Step 2: Create folder at drive root ---
FOLDER_NAME="FOLDER-${RUN_ID}"
FOLDER_RESPONSE=$(curl -s -X POST "${COMMON_HEADERS[@]}" -H "content-type: application/json" \
  -d "{\"name\":\"${FOLDER_NAME}\",\"parent_folder_id\":\"root\",\"drive_id\":\"${DRIVE_ID}\"}" \
  "${UNIFY_HOST}/file-storage/folders")

FOLDER_ID=$(printf '%s' "$FOLDER_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data['data']['id'])
")

if [ -z "$FOLDER_ID" ]; then
  echo "ERROR: folder creation failed"
  echo "Response: $FOLDER_RESPONSE"
  exit 1
fi
echo "folder_id: ${FOLDER_ID}"

# --- Step 3: Upload three text files into the folder ---
FILE_IDS=()
for i in 1 2 3; do
  FILE_NAME="NOTE-${RUN_ID}-${i}.txt"
  BODY="This is note ${i} for run ${RUN_ID}."
  METADATA_JSON=$(python3 -c "
import json
print(json.dumps({'name': '${FILE_NAME}', 'parent_folder_id': '${FOLDER_ID}', 'drive_id': '${DRIVE_ID}'}))
")
  UPLOAD_RESPONSE=$(printf '%s' "$BODY" | curl -s -X POST "${COMMON_HEADERS[@]}" \
    -H "x-apideck-metadata: ${METADATA_JSON}" \
    -H "content-type: application/octet-stream" \
    --data-binary @- \
    "${UPLOAD_HOST}/file-storage/files")

  FILE_ID=$(printf '%s' "$UPLOAD_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data['data']['id'])
")

  if [ -z "$FILE_ID" ]; then
    echo "ERROR: file upload ${i} failed"
    echo "Response: $UPLOAD_RESPONSE"
    exit 1
  fi
  echo "file ${i} id: ${FILE_ID}"
  FILE_IDS+=("\"$FILE_ID\"")
done

# --- Step 4: Write output.log ---
IDS_JOINED=$(IFS=,; echo "${FILE_IDS[*]}")
printf '{"folder_id": "%s", "file_ids": [%s]}' "$FOLDER_ID" "$IDS_JOINED" > /home/user/apideck_task/output.log

echo "Done. output.log:"
cat /home/user/apideck_task/output.log