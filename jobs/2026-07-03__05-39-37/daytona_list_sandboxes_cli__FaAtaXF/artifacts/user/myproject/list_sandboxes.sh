#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/user/myproject"
RUN_ID="$(cat /logs/artifacts/run-id)"
SANDBOX_NAME="lst-${RUN_ID}"

# 1. Authenticate with the Daytona CLI
daytona login --api-key "$DAYTONA_API_KEY"

# 2. Create the sandbox (default snapshot is fine)
daytona create --name "$SANDBOX_NAME"

# 3. Capture the full JSON listing of all sandboxes for the account.
#    The listing is paginated via a "nextCursor" field; loop until exhausted
#    so the persisted file contains the complete set.
: > "${PROJECT_DIR}/sandboxes.json"
echo '{"items":[]}' > "${PROJECT_DIR}/sandboxes.json"
CURSOR=""
for _ in $(seq 1 20); do
  if [ -n "$CURSOR" ]; then
    PAGE_JSON="$(daytona list --format json --cursor "$CURSOR")"
  else
    PAGE_JSON="$(daytona list --format json)"
  fi
  jq --argjson acc "$(cat "${PROJECT_DIR}/sandboxes.json")" \
     --argjson page "$PAGE_JSON" \
     '{items: ($acc.items + $page.items), nextCursor: $page.nextCursor}' \
     > "${PROJECT_DIR}/sandboxes.json.tmp"
  mv "${PROJECT_DIR}/sandboxes.json.tmp" "${PROJECT_DIR}/sandboxes.json"
  CURSOR="$(jq -r '.nextCursor // empty' "${PROJECT_DIR}/sandboxes.json")"
  [ -z "$CURSOR" ] && break
done

# 4. Extract the id of the sandbox we just created and write the one-line summary.
#    The created sandbox may take a moment to appear in the listing, so retry briefly.
SANDBOX_ID=""
for _ in $(seq 1 10); do
  SANDBOX_ID="$(jq -r --arg name "$SANDBOX_NAME" \
    '.items[] | select(.name == $name) | .id' \
    "${PROJECT_DIR}/sandboxes.json" | head -n1)"
  [ -n "$SANDBOX_ID" ] && break
  sleep 3
  daytona list --format json > "${PROJECT_DIR}/sandboxes.json"
done

printf 'Created: %s with id %s\n' "$SANDBOX_NAME" "$SANDBOX_ID" > "${PROJECT_DIR}/output.log"

echo "Done. Summary:"
cat "${PROJECT_DIR}/output.log"