#!/bin/bash

# Ensure we exit on error
set -e

echo "Checking if Typesense server is listening on port 8108..."
if ! curl -s http://127.0.0.1:8108/health > /dev/null; then
  echo "Typesense server is not running. Starting Typesense..."
  mkdir -p /var/lib/typesense-data
  API_KEY=$(cat /etc/typesense-api-key)
  /usr/local/bin/typesense-server --data-dir=/var/lib/typesense-data --api-key="$API_KEY" --api-port=8108 --api-address=127.0.0.1 --enable-cors=true > /var/log/typesense.log 2>&1 &
  
  # Wait for Typesense to start up
  echo "Waiting for Typesense server to become healthy..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8108/health | grep -q '"ok":true'; then
      echo "Typesense is healthy and ready!"
      break
    fi
    sleep 0.5
  done
else
  echo "Typesense server is already running and healthy."
fi

echo "Starting Node.js web server..."
exec node /home/user/admin-ui/server.js
