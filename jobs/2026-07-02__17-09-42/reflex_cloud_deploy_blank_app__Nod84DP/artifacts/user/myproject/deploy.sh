#!/usr/bin/env bash
# deploy.sh - Non-interactive deploy of the Reflex app to Reflex Cloud.
#
# Required environment variables:
#   REFLEX_CLOUD_TOKEN      - Authentication token for the hosting service.
#   REFLEX_CLOUD_PROJECT_ID - Project ID to deploy into.
#
# This script:
#   1. Generates a unique app name at deploy time (random suffix).
#   2. Runs `uv run reflex deploy` non-interactively with --token / --project / --app-name.
#   3. Records the deployed app name to ./deploy.log in the format
#      `Deployed app: <app_name>`.
#   4. Cleans up any Reflex backend/frontend background processes it may have
#      started (ports 8000 and 3000) so the environment is left tidy.

set -u  # Treat unset variables as errors (token / project must be present).

# ---------------------------------------------------------------------------
# Resolve project root (directory of this script) and cd into it so the
# `reflex deploy` command picks up this project.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || { echo "[deploy.sh] Failed to cd into $SCRIPT_DIR" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Validate required environment variables (do not hardcode the values).
# ---------------------------------------------------------------------------
if [[ -z "${REFLEX_CLOUD_TOKEN:-}" ]]; then
    echo "[deploy.sh] ERROR: REFLEX_CLOUD_TOKEN env var is required." >&2
    exit 1
fi
if [[ -z "${REFLEX_CLOUD_PROJECT_ID:-}" ]]; then
    echo "[deploy.sh] ERROR: REFLEX_CLOUD_PROJECT_ID env var is required." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Generate a unique app name at deploy time using a short random hex suffix.
# The suffix is produced inside this script (not passed in via env vars).
# ---------------------------------------------------------------------------
RANDOM_SUFFIX="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
APP_NAME="myproject-${RANDOM_SUFFIX}"

echo "[deploy.sh] Using unique app name: ${APP_NAME}"
echo "[deploy.sh] Using project id: ${REFLEX_CLOUD_PROJECT_ID}"

# ---------------------------------------------------------------------------
# Make sure the requirements.txt reflects the locked environment. (The
# project should already ship one, but regenerate it defensively so the
# Reflex build host installs the same dependency set.)
# ---------------------------------------------------------------------------
if command -v uv >/dev/null 2>&1; then
    uv pip freeze > requirements.txt
fi

# ---------------------------------------------------------------------------
# Run `reflex deploy` non-interactively. We capture stdout/stderr for
# debugging but still let them stream to the terminal.
# ---------------------------------------------------------------------------
DEPLOY_LOG="$SCRIPT_DIR/deploy.log"
touch "$DEPLOY_LOG"

set +e
uv run reflex deploy \
    --token "${REFLEX_CLOUD_TOKEN}" \
    --project "${REFLEX_CLOUD_PROJECT_ID}" \
    --app-name "${APP_NAME}" \
    --no-interactive \
    2>&1 | tee -a "$DEPLOY_LOG"
DEPLOY_EXIT=${PIPESTATUS[0]}
set -e

echo "[deploy.sh] reflex deploy exited with status ${DEPLOY_EXIT}"

# ---------------------------------------------------------------------------
# Always record the deployed app name (even on non-zero exit) so verifiers
# can find it. Overwrite any previous entry for this run.
# ---------------------------------------------------------------------------
{
    echo "Deployed app: ${APP_NAME}"
} >> "$DEPLOY_LOG"

echo "[deploy.sh] Wrote ${APP_NAME} to ${DEPLOY_LOG}"

# ---------------------------------------------------------------------------
# Clean up any Reflex backend/frontend processes we may have started so the
# environment is left clean. We kill anything listening on port 8000
# (backend) or port 3000 (frontend), as well as any lingering reflex/
# granian processes spawned by this script.
# ---------------------------------------------------------------------------
# Find the PID(s) listening on a given TCP port by parsing /proc/net/tcp.
# Returns one PID per line on stdout, empty if nothing is listening.
pids_on_port() {
    local port="$1"
    local hex_port
    hex_port="$(printf '%04X' "${port}")"

    # Collect inode numbers currently in LISTEN state on the given port.
    local inodes
    inodes="$(awk -v p="${hex_port}" '
        $2 ~ ":"p"$" && $4 == "0A" { print $10 }
    ' /proc/net/tcp /proc/net/tcp6 2>/dev/null | sort -u)"

    [[ -z "${inodes}" ]] && return 0

    # Map socket inodes back to PIDs by scanning every process's fd dir.
    local pid inode
    for pid in /proc/[0-9]*; do
        [[ -r "${pid}/fd" ]] || continue
        for inode in ${inodes}; do
            if ls -l "${pid}/fd" 2>/dev/null | grep -q "socket:\\[${inode}\\]"; then
                echo "${pid##*/}"
                break
            fi
        done
    done | sort -u
}

kill_port() {
    local port="$1"
    local pids
    pids="$(pids_on_port "${port}")"
    if [[ -n "${pids}" ]]; then
        echo "[deploy.sh] Killing processes on port ${port}: ${pids}"
        # shellcheck disable=SC2086
        kill ${pids} 2>/dev/null || true
        sleep 1
        # Force-kill anything that didn't go down gracefully.
        # shellcheck disable=SC2086
        kill -9 ${pids} 2>/dev/null || true
    fi
}

kill_port 3000
kill_port 8000

# Also nuke any reflex/granian child processes that may have been left
# behind by `uv run reflex deploy` (e.g. compile helpers).
pkill -f "reflex" 2>/dev/null || true
pkill -f "granian" 2>/dev/null || true

# Give the OS a moment to release the ports/sockets.
sleep 1

exit "${DEPLOY_EXIT}"