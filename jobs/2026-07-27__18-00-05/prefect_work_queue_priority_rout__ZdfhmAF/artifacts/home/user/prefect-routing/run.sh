#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
export PREFECT_API_URL="http://127.0.0.1:4200/api"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_ID="$(cat /logs/artifacts/run-id)"

POOL_NAME="routing-pool-${RUN_ID}"

Q_CRITICAL="critical-${RUN_ID}"
Q_STANDARD="standard-${RUN_ID}"
Q_BULK="bulk-${RUN_ID}"

D_CRITICAL="critical-deploy-${RUN_ID}"
D_STANDARD="standard-deploy-${RUN_ID}"
D_BULK="bulk-deploy-${RUN_ID}"

echo "=== Prefect Work-Queue Routing Setup ==="
echo "Run ID:       ${RUN_ID}"
echo "Work Pool:    ${POOL_NAME}"
echo "Queues:       ${Q_CRITICAL} (prio=1, limit=1)"
echo "              ${Q_STANDARD} (prio=5, limit=3)"
echo "              ${Q_BULK}     (prio=10, limit=5)"
echo ""

# ── Step 1: Create the work pool (idempotent) ─────────────────────────────────
echo "--- Step 1: Creating work pool '${POOL_NAME}' ---"
if prefect work-pool inspect "${POOL_NAME}" &>/dev/null; then
    echo "Work pool '${POOL_NAME}' already exists."
else
    prefect work-pool create "${POOL_NAME}" --type process
    echo "Work pool '${POOL_NAME}' created."
fi
echo ""

# ── Step 2: Create/update the three work queues ───────────────────────────────
echo "--- Step 2: Creating/updating work queues ---"
python3 -c "
import asyncio
from prefect import get_client

async def main():
    async with get_client() as client:
        desired = [
            ('${Q_CRITICAL}', 1, 1),
            ('${Q_STANDARD}', 5, 3),
            ('${Q_BULK}',     10, 5),
        ]

        for name, priority, concurrency_limit in desired:
            # Try to read existing queue
            try:
                q = await client.read_work_queue_by_name(name=name, work_pool_name='${POOL_NAME}')
                # Update existing queue
                await client.update_work_queue(
                    id=q.id,
                    priority=priority,
                    concurrency_limit=concurrency_limit,
                )
                print(f\"Updated queue '{name}' (prio={priority}, limit={concurrency_limit})\")
            except Exception:
                # Create new queue
                await client.create_work_queue(
                    name=name,
                    priority=priority,
                    concurrency_limit=concurrency_limit,
                    work_pool_name='${POOL_NAME}',
                )
                print(f\"Created queue '{name}' (prio={priority}, limit={concurrency_limit})\")

asyncio.run(main())
"
echo ""

# ── Step 3: Remove old deployments with the same names ────────────────────────
echo "--- Step 3: Cleaning up old deployments ---"
for dep_name in "${D_CRITICAL}" "${D_STANDARD}" "${D_BULK}"; do
    existing_id=$(prefect deployment ls --output json 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data:
    if d.get('name') == '${dep_name}':
        print(d['id'])
        break
" 2>/dev/null || true)
    if [ -n "${existing_id}" ]; then
        prefect deployment delete "${existing_id}" --yes 2>/dev/null || true
        echo "Deleted old deployment '${dep_name}'."
    fi
done
echo ""

# ── Step 4: Create the three deployments ──────────────────────────────────────
echo "--- Step 4: Creating deployments ---"

cd "${PROJECT_DIR}"

prefect deploy routing_flow.py:routing_flow \
    --name "${D_CRITICAL}" \
    --pool "${POOL_NAME}" \
    --work-queue "${Q_CRITICAL}" \
    --param "queue_name=${Q_CRITICAL}" \
    2>&1 | tail -3
echo ""

prefect deploy routing_flow.py:routing_flow \
    --name "${D_STANDARD}" \
    --pool "${POOL_NAME}" \
    --work-queue "${Q_STANDARD}" \
    --param "queue_name=${Q_STANDARD}" \
    2>&1 | tail -3
echo ""

prefect deploy routing_flow.py:routing_flow \
    --name "${D_BULK}" \
    --pool "${POOL_NAME}" \
    --work-queue "${Q_BULK}" \
    --param "queue_name=${Q_BULK}" \
    2>&1 | tail -3
echo ""

# ── Step 5: Start a worker for this pool in the background ────────────────────
echo "--- Step 5: Starting worker ---"
prefect worker start \
    --pool "${POOL_NAME}" \
    --limit 10 \
    &
WORKER_PID=$!
echo "Worker started (PID=${WORKER_PID})."
sleep 3
echo ""

# ── Step 6: Submit one run per deployment ─────────────────────────────────────
echo "--- Step 6: Submitting flow runs ---"

run_critical=$(prefect deployment run "${D_CRITICAL}" 2>&1 | grep -oP 'Flow run \K[^ ]+' | head -1)
echo "Submitted '${D_CRITICAL}' → run ${run_critical}"

run_standard=$(prefect deployment run "${D_STANDARD}" 2>&1 | grep -oP 'Flow run \K[^ ]+' | head -1)
echo "Submitted '${D_STANDARD}' → run ${run_standard}"

run_bulk=$(prefect deployment run "${D_BULK}" 2>&1 | grep -oP 'Flow run \K[^ ]+' | head -1)
echo "Submitted '${D_BULK}' → run ${run_bulk}"
echo ""

# ── Step 7: Wait for all three runs to reach a terminal state ─────────────────
echo "--- Step 7: Waiting for runs to complete ---"

MAX_WAIT=120
POLL_INTERVAL=3
elapsed=0

while true; do
    status_critical=$(prefect flow-run inspect "${run_critical}" --output json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',{}).get('type','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    status_standard=$(prefect flow-run inspect "${run_standard}" --output json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',{}).get('type','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    status_bulk=$(prefect flow-run inspect "${run_bulk}" --output json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',{}).get('type','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")

    echo "[${elapsed}s] critical=${status_critical}  standard=${status_standard}  bulk=${status_bulk}"

    all_done=true
    for s in "${status_critical}" "${status_standard}" "${status_bulk}"; do
        case "${s}" in
            COMPLETED|FAILED|CANCELLED|CRASHED) ;;
            *) all_done=false ;;
        esac
    done

    if ${all_done}; then
        echo ""
        echo "All runs reached a terminal state."
        break
    fi

    elapsed=$((elapsed + POLL_INTERVAL))
    if [ ${elapsed} -ge ${MAX_WAIT} ]; then
        echo "ERROR: Timed out after ${MAX_WAIT}s waiting for runs to complete."
        kill ${WORKER_PID} 2>/dev/null || true
        exit 1
    fi

    sleep ${POLL_INTERVAL}
done
echo ""

# ── Step 8: Stop the worker ───────────────────────────────────────────────────
echo "--- Step 8: Stopping worker ---"
kill ${WORKER_PID} 2>/dev/null || true
wait ${WORKER_PID} 2>/dev/null || true
echo "Worker stopped."
echo ""

# ── Step 9: Verify all runs completed successfully ────────────────────────────
echo "--- Step 9: Verification ---"
all_ok=true

for run_info in "${run_critical}:${D_CRITICAL}" "${run_standard}:${D_STANDARD}" "${run_bulk}:${D_BULK}"; do
    run_id="${run_info%%:*}"
    dep_name="${run_info##*:}"
    status=$(prefect flow-run inspect "${run_id}" --output json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('state',{}).get('type','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    if [ "${status}" = "COMPLETED" ]; then
        echo "  ✓ ${dep_name} → ${run_id} → ${status}"
    else
        echo "  ✗ ${dep_name} → ${run_id} → ${status}"
        all_ok=false
    fi
done
echo ""

if ${all_ok}; then
    echo "=== SUCCESS: All three runs completed successfully! ==="
    echo ""
    echo "Inspect in the UI:"
    echo "  Work Pools: http://127.0.0.1:4200/work-pools"
    echo "  Flow Runs:  http://127.0.0.1:4200/runs"
    exit 0
else
    echo "=== FAILURE: Not all runs completed successfully. ==="
    exit 1
fi
