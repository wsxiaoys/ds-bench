#!/bin/bash
# Ensure the data directory exists
mkdir -p /home/user/geo-search/data

# Check if Typesense is already running and healthy
if curl -s -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY" http://localhost:8108/health | grep -q '"ok":true'; then
  echo "Typesense is already running and healthy."
  exit 0
fi

# Start Typesense server in the background
# We pass --api-key using the TYPESENSE_API_KEY environment variable.
if [ -z "$TYPESENSE_API_KEY" ]; then
  echo "Error: TYPESENSE_API_KEY environment variable is not set." >&2
  exit 1
fi

nohup /usr/local/bin/typesense-server \
  --data-dir=/home/user/geo-search/data \
  --api-key="$TYPESENSE_API_KEY" \
  --api-port=8108 \
  --api-address=127.0.0.1 \
  > /home/user/geo-search/typesense.log 2>&1 &

# Wait for Typesense to become healthy
for i in {1..30}; do
  if curl -s -H "X-TYPESENSE-API-KEY: $TYPESENSE_API_KEY" http://localhost:8108/health | grep -q '"ok":true'; then
    echo "Typesense started and is healthy."
    exit 0
  fi
  sleep 1
done

echo "Error: Typesense failed to start or become healthy." >&2
exit 1
