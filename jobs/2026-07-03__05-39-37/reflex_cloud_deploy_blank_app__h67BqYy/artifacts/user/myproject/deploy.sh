#!/usr/bin/env bash
#
# deploy.sh — Non-interactively deploy this Reflex app to Reflex Cloud.
#
# Reads credentials from the environment:
#   REFLEX_CLOUD_TOKEN        Reflex Cloud authentication token (required)
#   REFLEX_CLOUD_PROJECT_ID   Reflex Cloud project id to deploy into (required)
#
# A unique app name is generated at deploy time using a short random suffix
# produced inside this script (the suffix is NOT passed in via an env var).
# The deployed app name is recorded to ./deploy.log as:
#   Deployed app: <app_name>
#
# Any Reflex background processes this script may have started (frontend on
# port 3000 or backend on port 8000) are killed before the script exits.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

LOG_FILE="${PROJECT_DIR}/deploy.log"
APP_BASE_NAME="myproject"
FRONTEND_PORT=3000
BACKEND_PORT=8000

# ---------------------------------------------------------------------------
# Cleanup helper — kill anything we may have left running on the Reflex ports.
# ---------------------------------------------------------------------------
cleanup_reflex_processes() {
    local pids
    for port in "$FRONTEND_PORT" "$BACKEND_PORT"; do
        if command -v fuser >/dev/null 2>&1; then
            pids="$(fuser "${port}/tcp" 2>/dev/null || true)"
            if [ -n "$pids" ]; then
                # shellcheck disable=SC2086
                kill $pids 2>/dev/null || true
            fi
        fi
        # Fallback: use lsof if available
        if command -v lsof >/dev/null 2>&1; then
            pids="$(lsof -ti tcp:"${port}" 2>/dev/null || true)"
            if [ -n "$pids" ]; then
                # shellcheck disable=SC2086
                kill $pids 2>/dev/null || true
            fi
        fi
    done
}

# Ensure cleanup runs on normal exit, errors, and signals.
trap cleanup_reflex_processes EXIT INT TERM

# ---------------------------------------------------------------------------
# Validate required environment variables (do NOT hardcode credentials).
# ---------------------------------------------------------------------------
if [ -z "${REFLEX_CLOUD_TOKEN:-}" ]; then
    echo "ERROR: REFLEX_CLOUD_TOKEN environment variable is not set." >&2
    exit 1
fi
if [ -z "${REFLEX_CLOUD_PROJECT_ID:-}" ]; then
    echo "ERROR: REFLEX_CLOUD_PROJECT_ID environment variable is not set." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Generate a unique app name at deploy time using a short random hex suffix.
# The suffix is produced inside this script itself (not via an env var).
# ---------------------------------------------------------------------------
RANDOM_SUFFIX="$(python3 -c "import secrets; print(secrets.token_hex(4))" 2>/dev/null || openssl rand -hex 4)"
APP_NAME="${APP_BASE_NAME}-${RANDOM_SUFFIX}"
echo "Generated unique app name: ${APP_NAME}"

# ---------------------------------------------------------------------------
# Deploy to Reflex Cloud non-interactively.
# ---------------------------------------------------------------------------
echo "Deploying ${APP_NAME} to Reflex Cloud (project: ${REFLEX_CLOUD_PROJECT_ID})..."

uv run reflex deploy \
    --app-name "${APP_NAME}" \
    --project "${REFLEX_CLOUD_PROJECT_ID}" \
    --token "${REFLEX_CLOUD_TOKEN}" \
    --no-interactive

DEPLOY_STATUS=$?

# ---------------------------------------------------------------------------
# Record the deployed app name to the log file.
# ---------------------------------------------------------------------------
echo "Deployed app: ${APP_NAME}" > "${LOG_FILE}"

if [ "$DEPLOY_STATUS" -ne 0 ]; then
    echo "ERROR: reflex deploy exited with status ${DEPLOY_STATUS}." >&2
    exit "$DEPLOY_STATUS"
fi

echo "Deployment complete. App name recorded in ${LOG_FILE}:"
cat "${LOG_FILE}"

# ---------------------------------------------------------------------------
# Final cleanup of any stray Reflex background processes before exiting.
# ---------------------------------------------------------------------------
cleanup_reflex_processes
exit 0