#!/usr/bin/env bash
#
# Idempotent, safely re-runnable entrypoint for the prioritized work-queue
# routing exercise.
#
# On every invocation this script will (all against the local Prefect
# server):
#   1. Make sure the local Prefect API server is up.
#   2. Create/update the work pool `routing-pool-<run-id>` (process type)
#      and its three priority + concurrency bounded work queues.
#   3. Create/update the three deployments, each routed to one queue.
#   4. Make sure a local process-type worker is polling that work pool.
#   5. Submit exactly one run of each deployment and block until all three
#      reach a terminal state.
#
# Exits 0 only if all three flow runs finished in the `Completed` state.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

RUN_ID_FILE="/logs/artifacts/run-id"
if [[ ! -f "$RUN_ID_FILE" ]]; then
    echo "ERROR: run-id file not found at $RUN_ID_FILE" >&2
    exit 1
fi
RUN_ID="$(tr -d '[:space:]' < "$RUN_ID_FILE")"
echo "[run.sh] using run-id: $RUN_ID"

POOL_NAME="routing-pool-${RUN_ID}"

export PREFECT_API_URL="http://127.0.0.1:4200/api"
API_HEALTH_URL="http://127.0.0.1:4200/api/health"
UI_URL="http://127.0.0.1:4200"

SERVER_LOG="${PROJECT_DIR}/.prefect_server.log"
SERVER_PID_FILE="${PROJECT_DIR}/.prefect_server.pid"
WORKER_LOG="${PROJECT_DIR}/.prefect_worker.log"
WORKER_PID_FILE="${PROJECT_DIR}/.prefect_worker.pid"

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

http_ok() {
    local url="$1"
    curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null | grep -qE '^(200|204)$'
}

wait_for_http() {
    local url="$1"
    local timeout="${2:-60}"
    local waited=0
    until http_ok "$url"; do
        sleep 1
        waited=$((waited + 1))
        if [[ "$waited" -ge "$timeout" ]]; then
            echo "[run.sh] ERROR: timed out waiting for $url" >&2
            return 1
        fi
    done
    return 0
}

pid_is_running() {
    local pid_file="$1"
    [[ -f "$pid_file" ]] || return 1
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

start_detached() {
    # start_detached <pid_file> <log_file> <cmd...>
    local pid_file="$1"; shift
    local log_file="$1"; shift
    setsid nohup "$@" >>"$log_file" 2>&1 < /dev/null &
    local pid=$!
    disown "$pid" 2>/dev/null || true
    echo "$pid" > "$pid_file"
}

# --------------------------------------------------------------------------
# 0. Make sure the installed FastAPI version is compatible with this
#    Prefect build. A too-new FastAPI breaks Prefect's custom router (404
#    handling raises a 500), which in turn breaks work pool / queue
#    creation. This is a no-op (fast) once the correct version is already
#    installed.
# --------------------------------------------------------------------------
CURRENT_FASTAPI_VERSION="$(python3 -c 'import importlib.metadata as m; print(m.version("fastapi"))' 2>/dev/null || echo "")"
if [[ "$CURRENT_FASTAPI_VERSION" != 0.115.* ]]; then
    echo "[run.sh] fastapi version '$CURRENT_FASTAPI_VERSION' is incompatible, pinning to 0.115.6 ..."
    pip install --quiet "fastapi==0.115.6" || {
        echo "[run.sh] WARNING: failed to pin fastapi version; continuing anyway" >&2
    }
fi

# --------------------------------------------------------------------------
# 1. Ensure the local Prefect server is running.
# --------------------------------------------------------------------------
if http_ok "$API_HEALTH_URL"; then
    echo "[run.sh] Prefect server already reachable at $UI_URL"
else
    if pid_is_running "$SERVER_PID_FILE"; then
        echo "[run.sh] a server process is already starting up, waiting for it..."
    else
        echo "[run.sh] starting local Prefect server ..."
        start_detached "$SERVER_PID_FILE" "$SERVER_LOG" \
            prefect server start --host 127.0.0.1 --port 4200
    fi
    wait_for_http "$API_HEALTH_URL" 90
    echo "[run.sh] Prefect server is up at $UI_URL"
fi

# --------------------------------------------------------------------------
# 2 & 3. Create/update the work pool, its work queues, and the deployments.
# --------------------------------------------------------------------------
echo "[run.sh] setting up work pool, work queues, and deployments ..."
python3 "${PROJECT_DIR}/orchestrate.py" setup

# --------------------------------------------------------------------------
# 4. Ensure a local process worker is polling the work pool.
# --------------------------------------------------------------------------
if pgrep -f "prefect worker start --pool ${POOL_NAME}( |$)" >/dev/null 2>&1; then
    echo "[run.sh] a worker for '${POOL_NAME}' is already running"
else
    echo "[run.sh] starting local worker for work pool '${POOL_NAME}' ..."
    start_detached "$WORKER_PID_FILE" "$WORKER_LOG" \
        prefect worker start --pool "$POOL_NAME"
fi

echo "[run.sh] waiting for the worker to come online ..."
waited=0
until prefect work-pool inspect "$POOL_NAME" 2>/dev/null | grep -q "status=WorkPoolStatus.READY"; do
    sleep 1
    waited=$((waited + 1))
    if [[ "$waited" -ge 60 ]]; then
        echo "[run.sh] ERROR: timed out waiting for worker to come online" >&2
        echo "[run.sh] --- worker log tail ---" >&2
        tail -n 50 "$WORKER_LOG" >&2 || true
        exit 1
    fi
done
echo "[run.sh] worker is online for pool '${POOL_NAME}'"

# --------------------------------------------------------------------------
# 5. Submit one run per deployment and wait for all three to complete.
# --------------------------------------------------------------------------
echo "[run.sh] submitting one run per deployment and waiting for completion ..."
python3 "${PROJECT_DIR}/orchestrate.py" trigger
STATUS=$?

if [[ "$STATUS" -eq 0 ]]; then
    echo "[run.sh] all three runs completed successfully."
    echo "[run.sh] inspect the results at:"
    echo "[run.sh]   Work Pools: ${UI_URL}/work-pools/work-pool/${POOL_NAME}"
    echo "[run.sh]   Flow Runs:  ${UI_URL}/flow-runs"
else
    echo "[run.sh] ERROR: one or more runs did not complete successfully." >&2
fi

exit "$STATUS"
