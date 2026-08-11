#!/bin/bash
# Ensure Typesense is running
if ! curl -s http://127.0.0.1:8108/health > /dev/null; then
  echo "Typesense is not running. Starting it..."
  API_KEY=$(cat /etc/typesense-api-key)
  mkdir -p /tmp/typesense-data
  /usr/local/bin/typesense-server --data-dir=/tmp/typesense-data --api-key="$API_KEY" --api-port=8108 --enable-cors > /tmp/typesense.log 2>&1 &
  # Wait for it to be ready
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8108/health | grep -q '"ok":true'; then
      echo "Typesense is ready."
      break
    fi
    sleep 0.5
  done
fi

# Start the Node.js server in the foreground
node /home/user/admin-ui/server.js
