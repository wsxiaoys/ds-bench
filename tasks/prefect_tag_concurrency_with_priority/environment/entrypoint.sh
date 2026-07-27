#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Boot a local Prefect server (UI http://127.0.0.1:4200, API http://127.0.0.1:4200/api)
export PREFECT_API_URL="http://127.0.0.1:4200/api"
mkdir -p /var/log

echo "[entrypoint] starting local Prefect server on 127.0.0.1:4200 ..."
prefect server start --host 127.0.0.1 --port 4200 > /var/log/prefect-server.log 2>&1 &

for i in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:4200/api/health" > /dev/null 2>&1; then
        echo "[entrypoint] Prefect server is healthy."
        break
    fi
    sleep 2
done

if ! curl -sf "http://127.0.0.1:4200/api/health" > /dev/null 2>&1; then
    echo "[entrypoint] WARNING: Prefect server did not become healthy within the timeout."
    echo "[entrypoint] --- prefect-server.log (tail) ---"
    tail -n 50 /var/log/prefect-server.log || true
fi

exec "$@"
