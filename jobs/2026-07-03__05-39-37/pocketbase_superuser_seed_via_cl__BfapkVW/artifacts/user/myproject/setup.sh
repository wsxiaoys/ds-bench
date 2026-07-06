#!/usr/bin/env bash
#
# setup.sh - Idempotent PocketBase v0.31.0 bootstrap script.
#
# This script:
#   1. Creates (or updates) a single superuser.
#   2. Applies the JS migration that defines the `tasks` collection.
#   3. Starts the PocketBase server in the background (kept alive after exit).
#   4. Authenticates as the superuser and seeds exactly 5 task records via the
#      REST API, skipping any that already exist.
#
# Running this script multiple times is safe: no duplicate superusers, no
# duplicate tasks, no errors, and it always exits with status 0.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR="/home/user/myproject"
PB_BIN="$PROJECT_DIR/pocketbase"
PB_DIR="$PROJECT_DIR/pb_data"
LOG_FILE="$PROJECT_DIR/pb_server.log"
PID_FILE="$PROJECT_DIR/pb_server.pid"

HOST="127.0.0.1"
PORT="8090"
BASE_URL="http://${HOST}:${PORT}"

ADMIN_EMAIL="admin@example.com"
ADMIN_PASS='Adm1n_passw0rd!'

# The exact task titles to seed (order is preserved, one record per title).
TASK_TITLES=(
  "Buy groceries"
  "Walk the dog"
  "Read a book"
  "Write weekly report"
  "Call mom"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { printf '[setup] %s\n' "$*"; }
err()  { printf '[setup][ERROR] %s\n' "$*" >&2; }

# Wait until the PocketBase health endpoint responds with HTTP 200.
wait_for_server() {
  local attempts=0
  local max=60
  while (( attempts < max )); do
    if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    attempts=$(( attempts + 1 ))
    sleep 1
  done
  return 1
}

# Return the superuser auth token on stdout, empty string on failure.
get_admin_token() {
  curl -sf -X POST "${BASE_URL}/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"identity":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASS")" \
    | jq -r '.token // empty'
}

# Return the number of records in `tasks` whose title matches $1 (0 if none).
count_tasks_with_title() {
  local title="$1"
  curl -sf -G "${BASE_URL}/api/collections/tasks/records" \
    --data-urlencode "filter=title=\"${title}\"" \
    -H "Authorization: Bearer ${TOKEN}" \
    | jq -r '.items | length'
}

# Create a single task record with the given title.
create_task() {
  local title="$1"
  curl -sf -X POST "${BASE_URL}/api/collections/tasks/records" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"title":"%s"}' "$title")" >/dev/null
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
cd "$PROJECT_DIR"

log "Working directory: $PROJECT_DIR"

# --- Step 1: Superuser (upsert is idempotent) ------------------------------
log "Creating/updating superuser '$ADMIN_EMAIL'..."
"$PB_BIN" superuser upsert "$ADMIN_EMAIL" "$ADMIN_PASS" >/dev/null
log "Superuser ready."

# --- Step 2: Apply migrations ----------------------------------------------
log "Applying migrations..."
"$PB_BIN" migrate up >/dev/null
log "Migrations applied."

# --- Step 3: Start the server in the background ----------------------------
if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  log "PocketBase server is already running."
else
  log "Starting PocketBase server in the background..."
  # nohup + background keeps the process alive after this script exits.
  nohup "$PB_BIN" serve --http="${HOST}:${PORT}" \
    > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  disown || true

  if ! wait_for_server; then
    err "PocketBase server failed to become healthy within timeout."
    err "See $LOG_FILE for details."
    exit 1
  fi
  log "PocketBase server is up (pid $(cat "$PID_FILE"))."
fi

# --- Step 4: Authenticate as superuser -------------------------------------
log "Authenticating as superuser..."
TOKEN="$(get_admin_token)"
if [[ -z "${TOKEN:-}" ]]; then
  err "Unable to authenticate as superuser; cannot seed tasks."
  exit 1
fi
log "Authenticated."

# --- Step 5: Seed tasks (idempotent) ---------------------------------------
log "Seeding task records..."
for title in "${TASK_TITLES[@]}"; do
  count="$(count_tasks_with_title "$title")"
  if [[ "$count" -gt 0 ]]; then
    log "  - exists, skipping: $title"
  else
    create_task "$title"
    log "  - created:          $title"
  fi
done

log "Setup complete."
exit 0