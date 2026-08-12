#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Per instruction.md, a PocketBase v0.31.0 server with a pre-seeded
# `messages` collection is expected to already be running at
# http://127.0.0.1:8090 before the agent starts. Provision that here — not
# in test_initial_state.py, which must only assert this state.
PB_DATA_DIR=/home/user/pb_data
PB_URL=http://127.0.0.1:8090

mkdir -p "$PB_DATA_DIR"

pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir "$PB_DATA_DIR" >/tmp/pb-superuser.log 2>&1 || true

nohup pocketbase serve --http=0.0.0.0:8090 --dir "$PB_DATA_DIR" >/tmp/pocketbase.log 2>&1 &
disown

for i in $(seq 1 60); do
    if curl -fsS "$PB_URL/api/health" >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

TOKEN=$(curl -fsS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)

if [ -n "$TOKEN" ]; then
    if ! curl -fsS -H "Authorization: $TOKEN" "$PB_URL/api/collections/messages" >/dev/null 2>&1; then
        curl -fsS -X POST "$PB_URL/api/collections" \
            -H "Content-Type: application/json" \
            -H "Authorization: $TOKEN" \
            -d '{
                "name": "messages",
                "type": "base",
                "fields": [
                    {"name": "chat", "type": "text", "required": true},
                    {"name": "body", "type": "text", "required": false}
                ],
                "listRule": "",
                "viewRule": "",
                "createRule": "",
                "updateRule": "",
                "deleteRule": ""
            }' >/dev/null 2>&1 || true
    fi
fi

exec "$@"
