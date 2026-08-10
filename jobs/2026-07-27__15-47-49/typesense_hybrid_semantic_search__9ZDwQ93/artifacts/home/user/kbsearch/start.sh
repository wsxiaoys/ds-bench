#!/bin/bash
# Start script for the knowledge-base search web app
set -e

# Ensure Typesense is running
if ! curl -s http://127.0.0.1:8108/health -H "X-TYPESENSE-API-KEY: $(cat /etc/typesense-api-key)" > /dev/null 2>&1; then
    echo "Starting Typesense server..."
    typesense-server \
        --data-dir=/tmp/typesense-data \
        --api-key="$(cat /etc/typesense-api-key)" \
        --api-address=127.0.0.1 \
        --api-port=8108 &
    # Wait for Typesense to be ready
    for i in $(seq 1 30); do
        if curl -s http://127.0.0.1:8108/health -H "X-TYPESENSE-API-KEY: $(cat /etc/typesense-api-key)" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# Change to project directory
cd /home/user/kbsearch

# Start the Flask web server
exec python3 app.py
