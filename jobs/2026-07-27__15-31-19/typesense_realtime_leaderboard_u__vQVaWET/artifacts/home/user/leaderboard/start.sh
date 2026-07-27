#!/bin/bash

# Ensure we are in the correct directory
cd /home/user/leaderboard

# Check if Typesense server is running, if not start it
if ! curl -s -o /dev/null -H "X-TYPESENSE-API-KEY: BrLdkKFyT5LHZIBip0OyJ1Fp7Swi477a" http://127.0.0.1:8108/collections; then
  echo "Typesense is not running. Starting Typesense server..."
  mkdir -p /tmp/typesense-data
  /usr/local/bin/typesense-server --data-dir=/tmp/typesense-data --api-key=BrLdkKFyT5LHZIBip0OyJ1Fp7Swi477a --api-port=8108 --api-address=127.0.0.1 > /tmp/typesense.log 2>&1 &
  
  # Wait for Typesense to be ready
  for i in {1..30}; do
    if curl -s -o /dev/null -H "X-TYPESENSE-API-KEY: BrLdkKFyT5LHZIBip0OyJ1Fp7Swi477a" http://127.0.0.1:8108/collections; then
      echo "Typesense server is ready."
      break
    fi
    sleep 0.5
  done
else
  echo "Typesense server is already running."
fi

# Start the web app and block
echo "Starting Realtime Leaderboard Web App..."
exec node server.js
