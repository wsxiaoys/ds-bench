#!/bin/bash

# Ensure /var/lib/typesense exists
mkdir -p /var/lib/typesense

# Check if Typesense is already running on port 8108
if ! curl -s http://127.0.0.1:8108/health > /dev/null; then
  echo "Typesense is not running. Starting typesense-server..."
  API_KEY=$(cat /etc/typesense-api-key)
  /usr/local/bin/typesense-server --data-dir=/var/lib/typesense --api-key="$API_KEY" --api-port=8108 --api-address=127.0.0.1 > /tmp/typesense-server.log 2>&1 &
  
  # Wait for Typesense to be ready
  echo "Waiting for Typesense to be ready..."
  for i in {1..30}; do
    if curl -s http://127.0.0.1:8108/health > /dev/null; then
      echo "Typesense is ready!"
      break
    fi
    sleep 1
  done
fi

# Start the Node.js web app
echo "Starting web application..."
exec node /home/user/leaderboard/index.js
