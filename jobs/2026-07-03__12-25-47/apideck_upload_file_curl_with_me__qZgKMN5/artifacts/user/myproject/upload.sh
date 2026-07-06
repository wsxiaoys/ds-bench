#!/usr/bin/env bash
set -euo pipefail

API_KEY="${APIDECK_API_KEY}"
APP_ID="${APIDECK_APP_ID}"
CONSUMER_ID="${APIDECK_CONSUMER_ID}"
DRIVE_NAME="${APIDECK_FILE_STORAGE_DRIVE_NAME}"
RUN_ID="$(cat /logs/artifacts/run-id)"

# Discover the drive id by name
DRIVES_JSON="$(curl -sS -X GET 'https://unify.apideck.com/file-storage/drives' \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "x-apideck-app-id: ${APP_ID}" \
  -H "x-apideck-consumer-id: ${CONSUMER_ID}" \
  -H "x-apideck-service-id: onedrive")"

DRIVE_ID="$(printf '%s' "${DRIVES_JSON}" | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; print(next(d['id'] for d in data if d['name']==sys.argv[1]))" "${DRIVE_NAME}")"
echo "Using drive id: ${DRIVE_ID}"

FILE_NAME="apideck-curl-${RUN_ID}.txt"
FILE_PATH="/tmp/${FILE_NAME}"

# Write the exact file body required by the task:
# 58 bytes: 57 ASCII characters + a single LF (0x0A), no trailing whitespace.
python3 -c 'import sys; open(sys.argv[1], "wb").write(b"Uploaded via Apideck File Storage direct upload curl test\n")' "${FILE_PATH}"
echo "File size: $(wc -c < "${FILE_PATH}") bytes"
od -c "${FILE_PATH}" | head

# Build the metadata JSON string. Pass it via the x-apideck-metadata header.
METADATA_JSON="$(python3 -c 'import sys, json; print(json.dumps({"name": sys.argv[1], "parent_folder_id": "root", "drive_id": sys.argv[2]}))' "${FILE_NAME}" "${DRIVE_ID}")"
echo "Metadata: ${METADATA_JSON}"

# Upload to upload.apideck.com (NOT unify.apideck.com). Body is raw binary, not multipart.
RESPONSE="$(curl -sS -X POST 'https://upload.apideck.com/file-storage/files' \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "x-apideck-app-id: ${APP_ID}" \
  -H "x-apideck-consumer-id: ${CONSUMER_ID}" \
  -H "x-apideck-service-id: onedrive" \
  -H 'Content-Type: text/plain' \
  -H "x-apideck-metadata: ${METADATA_JSON}" \
  --data-binary "@${FILE_PATH}")"

echo "Upload response: ${RESPONSE}"

FILE_ID="$(printf '%s' "${RESPONSE}" | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["id"])')"
echo "File id: ${FILE_ID}"

# Write the unified file id as the only non-empty line in output.log.
printf '%s\n' "${FILE_ID}" > /home/user/myproject/output.log
echo '--- output.log ---'
cat /home/user/myproject/output.log
echo '--- end ---'
