#!/usr/bin/env bash
# Reproducible "scheduling lab" setup.
#
# Run from /home/user/scheduling_lab as:
#   bash setup.sh
#
# (Re)creates two deployments of a single flow against the local Prefect
# server:
#   - pulse-active-<run-id>  : active 30s schedule, nothing executes its
#                              runs -> they become Late in the UI.
#   - pulse-paused-<run-id>  : schedule switched off (inactive) and the
#                              deployment itself paused -> no upcoming runs.
#
# This script never starts a worker, agent, or `flow.serve()` process, so it
# never executes any scheduled flow run itself. It is idempotent: re-running
# it re-applies (upserts) the same two deployment definitions and converges
# to the same end state.

set -euo pipefail

# Always operate relative to this script's directory.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Target only the local, self-hosted Prefect server.
export PREFECT_API_URL="${PREFECT_API_URL:-http://127.0.0.1:4200/api}"

RUN_ID_FILE="/logs/artifacts/run-id"
if [[ ! -f "${RUN_ID_FILE}" ]]; then
  echo "ERROR: run-id file not found at ${RUN_ID_FILE}" >&2
  exit 1
fi
RUN_ID="$(tr -d '[:space:]' < "${RUN_ID_FILE}")"
if [[ -z "${RUN_ID}" ]]; then
  echo "ERROR: run-id file at ${RUN_ID_FILE} is empty" >&2
  exit 1
fi
export SCHEDULING_LAB_RUN_ID="${RUN_ID}"

echo "== Prefect scheduling lab setup =="
echo "run-id            : ${RUN_ID}"
echo "PREFECT_API_URL   : ${PREFECT_API_URL}"

echo "Checking API health..."
if ! curl -sf "${PREFECT_API_URL}/health" > /dev/null; then
  echo "ERROR: Prefect API at ${PREFECT_API_URL} is not reachable." >&2
  exit 1
fi

echo "Applying deployments (idempotent upsert, no worker/agent started)..."
python3 deploy.py

echo "Setup complete."
echo "  pulse-active-${RUN_ID}: active 30s schedule -> expect Late runs shortly."
echo "  pulse-paused-${RUN_ID}: schedule inactive & deployment paused -> no upcoming runs."
