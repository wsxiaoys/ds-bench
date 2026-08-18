#!/bin/bash

# Ensure Typesense is running
if ! curl -s -H "X-TYPESENSE-API-KEY: kPVJcFDqdf3x4g7l4fsWvukgjj8UlFjn" http://127.0.0.1:8108/health | grep -q '"ok":true'; then
  echo "Typesense is not running. Starting Typesense..."
  mkdir -p /var/lib/typesense
  /usr/local/bin/typesense-server --data-dir=/var/lib/typesense --api-key=kPVJcFDqdf3x4g7l4fsWvukgjj8UlFjn --api-port=8108 > /var/log/typesense-server.log 2>&1 &
  
  # Wait for Typesense to be healthy
  for i in {1..30}; do
    if curl -s -H "X-TYPESENSE-API-KEY: kPVJcFDqdf3x4g7l4fsWvukgjj8UlFjn" http://127.0.0.1:8108/health | grep -q '"ok":true'; then
      echo "Typesense is up and running!"
      break
    fi
    sleep 1
  done
fi

# Run Node.js application in foreground
cd /home/user/filterchip
exec npm start
