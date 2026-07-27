#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Start the self-hosted Prefect server locally so the environment matches
# test_initial_state.py (API reachable at http://127.0.0.1:4200/api).
# Everything stays on 127.0.0.1; no external/cloud service is used.
export PREFECT_HOME="${PREFECT_HOME:-/root/.prefect}"
export PREFECT_SERVER_API_HOST="127.0.0.1"
export PREFECT_SERVER_API_PORT="4200"
mkdir -p "$PREFECT_HOME"

# Persist the local API URL into the active Prefect profile so every CLI
# invocation (including the agent's own shells) targets the local server.
prefect config set PREFECT_API_URL="http://127.0.0.1:4200/api" >/dev/null 2>&1 || true

if ! curl -fsS "http://127.0.0.1:4200/api/health" >/dev/null 2>&1; then
    nohup prefect server start --host 127.0.0.1 --port 4200 \
        >/root/.prefect/server.log 2>&1 &
fi

# Wait until the API is healthy so the agent and tests can rely on it.
for _ in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:4200/api/health" >/dev/null 2>&1; then
        echo "Prefect server is healthy at http://127.0.0.1:4200/api"
        break
    fi
    sleep 2
done

exec "$@"
