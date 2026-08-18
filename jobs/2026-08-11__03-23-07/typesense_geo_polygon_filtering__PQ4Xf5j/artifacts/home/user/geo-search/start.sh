#!/usr/bin/env bash
set -euo pipefail

# Project path
PROJECT_DIR="/home/user/geo-search"
DATA_DIR="${PROJECT_DIR}/data"
LOG_FILE="${PROJECT_DIR}/typesense.log"
PORT=8108

mkdir -p "$DATA_DIR"

# Check if already running and healthy
if curl -s "http://localhost:${PORT}/health" | grep -q '"ok":true'; then
  echo "Typesense is already running and healthy on port ${PORT}."
  exit 0
fi

# If not running or not healthy, pkill any existing typesense-server to be safe
echo "Typesense is not running or not healthy. Ensuring no stale processes are running..."
pkill -f typesense-server || true
sleep 1

# Start typesense-server
echo "Starting Typesense server..."
nohup /usr/local/bin/typesense-server \
  --data-dir="$DATA_DIR" \
  --api-key="${TYPESENSE_API_KEY}" \
  --api-port="${PORT}" \
  > "$LOG_FILE" 2>&1 &

# Block until healthy
echo "Waiting for Typesense to become healthy..."
for i in {1..30}; do
  if curl -s "http://localhost:${PORT}/health" | grep -q '"ok":true'; then
    echo "Typesense is healthy!"
    exit 0
  fi
  sleep 1
done

echo "Typesense failed to start or become healthy."
cat "$LOG_FILE"
exit 1
