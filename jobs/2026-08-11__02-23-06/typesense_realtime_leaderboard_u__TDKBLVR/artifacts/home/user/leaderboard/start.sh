#!/bin/bash

# Ensure typesense-server is running
if ! curl -s http://127.0.0.1:8108/health > /dev/null; then
  echo "Typesense not running on port 8108. Starting typesense-server..."
  mkdir -p /tmp/typesense-data
  /usr/local/bin/typesense-server --data-dir=/tmp/typesense-data --api-key=0Ali0hLV0YSgMuIqKlQZKJZozZIAcsIH &
fi

# Run the web app
node server.js
