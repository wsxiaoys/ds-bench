#!/bin/bash
# Start script for the Typesense Filter Chip Builder
# Ensures Typesense is running, then launches the web server on port 8080.

set -e

API_KEY=$(cat /etc/typesense-api-key)
TYPESENSE_DATA_DIR="/tmp/typesense-data"
TYPESENSE_PORT=8108

# Ensure data directory exists
mkdir -p "$TYPESENSE_DATA_DIR"

# Start Typesense if not already running
if ! curl -s "http://127.0.0.1:${TYPESENSE_PORT}/health" > /dev/null 2>&1; then
  echo "Starting Typesense server..."
  typesense-server \
    --data-dir="$TYPESENSE_DATA_DIR" \
    --api-key="$API_KEY" \
    --api-port="$TYPESENSE_PORT" \
    &>/tmp/typesense.log &

  # Wait for Typesense to be ready
  for i in $(seq 1 30); do
    if curl -s "http://127.0.0.1:${TYPESENSE_PORT}/health" 2>/dev/null | grep -q '"ok":true'; then
      echo "Typesense is ready."
      break
    fi
    sleep 1
  done
fi

# Start the web server
cd /home/user/filterchip
exec python3 server.py
