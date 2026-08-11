#!/bin/bash

# Check if Typesense is running on port 8108
if ! curl -s -o /dev/null http://127.0.0.1:8108/health; then
  echo "Typesense is not running. Starting typesense-server..."
  mkdir -p /tmp/typesense-data
  /usr/local/bin/typesense-server --data-dir=/tmp/typesense-data --api-key=XiKwGzOimJpb7rQhnIYHPTGjm6X9xhpO --api-port=8108 --enable-cors > /tmp/typesense.log 2>&1 &
  
  # Wait for Typesense to be ready
  for i in {1..30}; do
    if curl -s -o /dev/null http://127.0.0.1:8108/health; then
      echo "Typesense started successfully."
      break
    fi
    sleep 0.5
  done
else
  echo "Typesense is already running."
fi

# Start the Node.js server
echo "Starting Express server on port 8080..."
exec node /home/user/filterchip/server.js
