#!/bin/bash
set -e

# Directory where typesense data will be stored
DATA_DIR="/home/user/geo-search/data"
mkdir -p "$DATA_DIR"

# Check if Typesense is already running and healthy
if curl -s -f -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY" http://localhost:8108/health 2>/dev/null | grep -q '"ok":true'; then
  echo "Typesense is already running and healthy."
  exit 0
fi

# Start Typesense server
echo "Starting Typesense server..."
nohup typesense-server \
  --data-dir="$DATA_DIR" \
  --api-key="$TYPESENSE_API_KEY" \
  --api-port=8108 \
  --api-address=127.0.0.1 \
  > "/home/user/geo-search/typesense.log" 2>&1 &

# Wait for Typesense to become healthy
echo "Waiting for Typesense to become healthy..."
for i in {1..30}; do
  if curl -s -f -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY" http://localhost:8108/health 2>/dev/null | grep -q '"ok":true'; then
    echo "Typesense started successfully and is healthy."
    exit 0
  fi
  sleep 1
done

echo "Error: Typesense failed to start or become healthy within 30 seconds."
cat "/home/user/geo-search/typesense.log"
exit 1
