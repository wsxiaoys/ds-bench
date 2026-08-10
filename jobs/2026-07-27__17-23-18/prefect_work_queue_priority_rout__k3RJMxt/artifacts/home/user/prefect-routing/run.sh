#!/bin/bash
set -euo pipefail

# Navigate to the project directory
cd /home/user/prefect-routing

# Read run-id
RUN_ID=$(cat /logs/artifacts/run-id | tr -d '[:space:]')
echo "Using RUN_ID: ${RUN_ID}"

# 1. Build the work pool (local process-type)
echo "Creating/updating work pool..."
prefect work-pool create "routing-pool-${RUN_ID}" --type process --overwrite

# 2. Build the three work queues idempotently
echo "Setting up work queues..."
# Delete existing queues first to ensure a clean slate (ignore failure if they don't exist)
prefect work-queue delete "critical-${RUN_ID}" -p "routing-pool-${RUN_ID}" || true
prefect work-queue delete "standard-${RUN_ID}" -p "routing-pool-${RUN_ID}" || true
prefect work-queue delete "bulk-${RUN_ID}" -p "routing-pool-${RUN_ID}" || true

# Recreate queues with correct priorities and concurrency limits
prefect work-queue create "critical-${RUN_ID}" --pool "routing-pool-${RUN_ID}" --priority 1 --limit 1
prefect work-queue create "standard-${RUN_ID}" --pool "routing-pool-${RUN_ID}" --priority 5 --limit 3
prefect work-queue create "bulk-${RUN_ID}" --pool "routing-pool-${RUN_ID}" --priority 10 --limit 5

# 3. Register the three deployments bound to their queues
echo "Registering deployments..."
prefect deploy ./flow.py:routing_flow --name "critical-deploy-${RUN_ID}" --pool "routing-pool-${RUN_ID}" --work-queue "critical-${RUN_ID}" --param name=critical
prefect deploy ./flow.py:routing_flow --name "standard-deploy-${RUN_ID}" --pool "routing-pool-${RUN_ID}" --work-queue "standard-${RUN_ID}" --param name=standard
prefect deploy ./flow.py:routing_flow --name "bulk-deploy-${RUN_ID}" --pool "routing-pool-${RUN_ID}" --work-queue "bulk-${RUN_ID}" --param name=bulk

# 4. Start the local worker in the background
echo "Starting local worker..."
prefect worker start --pool "routing-pool-${RUN_ID}" > /tmp/prefect-worker.log 2>&1 &
WORKER_PID=$!

# Ensure the worker is killed on exit (even if script fails or is interrupted)
cleanup() {
    echo "Stopping local worker..."
    kill -9 $WORKER_PID || true
}
trap cleanup EXIT

# 5. Submit runs, drive to completion, and check status
echo "Triggering runs and waiting for completion..."
python3 trigger_and_wait.py

echo "All runs completed successfully!"
