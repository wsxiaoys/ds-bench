#!/bin/bash

# Ensure typesense-server is running
if ! curl -s http://127.0.0.1:8108/health >/dev/null; then
  echo "Typesense is not running. Starting typesense-server..."
  mkdir -p /tmp/typesense-data
  API_KEY=$(cat /etc/typesense-api-key)
  /usr/local/bin/typesense-server --data-dir=/tmp/typesense-data --api-key="$API_KEY" --api-address=127.0.0.1 --api-port=8108 &
  
  # Wait for Typesense to start
  echo "Waiting for Typesense to start..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8108/health >/dev/null; then
      echo "Typesense started successfully!"
      break
    fi
    sleep 1
  done
fi

# Run the Node.js application in the foreground
cd /home/user/filterchip
exec node server.js
