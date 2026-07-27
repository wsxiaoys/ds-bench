#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TYPESENSE_DATA_DIR="${SCRIPT_DIR}/typesense-data"
TYPESENSE_API_KEY_FILE="/etc/typesense-api-key"
TYPESENSE_HOST="127.0.0.1"
TYPESENSE_PORT="8108"

mkdir -p "${TYPESENSE_DATA_DIR}"

API_KEY="$(cat "${TYPESENSE_API_KEY_FILE}")"

# Start Typesense if it isn't already responding on the expected port.
if ! curl -s -o /dev/null "http://${TYPESENSE_HOST}:${TYPESENSE_PORT}/health"; then
  echo "Starting Typesense server..."
  nohup typesense-server \
    --data-dir="${TYPESENSE_DATA_DIR}" \
    --api-key="${API_KEY}" \
    --api-address="${TYPESENSE_HOST}" \
    --api-port="${TYPESENSE_PORT}" \
    > "${SCRIPT_DIR}/typesense.log" 2>&1 &
fi

# Wait for Typesense to become healthy.
echo "Waiting for Typesense to be healthy..."
for i in $(seq 1 60); do
  if curl -s "http://${TYPESENSE_HOST}:${TYPESENSE_PORT}/health" | grep -q '"ok":true'; then
    echo "Typesense is healthy."
    break
  fi
  sleep 1
done

# Launch the Node.js web app in the foreground (this also indexes the
# documents into Typesense on startup before it begins listening).
cd "${SCRIPT_DIR}"
exec node server.js
