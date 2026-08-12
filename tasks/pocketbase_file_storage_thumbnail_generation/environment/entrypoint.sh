#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Per instruction.md, a local PocketBase server with an admin account and a
# pre-created `gallery` collection (file field with 100x100 thumbs) must
# already exist before the agent starts. Provision that here — not in
# test_initial_state.py, which must only assert this state.
pocketbase superuser upsert admin@example.com adminpassword >/tmp/pb-superuser.log 2>&1 || true

nohup pocketbase serve --http=0.0.0.0:8090 >/tmp/pocketbase.log 2>&1 &
disown

for i in $(seq 1 30); do
    if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

TOKEN=$(curl -fsS -X POST http://127.0.0.1:8090/api/collections/_superusers/auth-with-password \
    -H "Content-Type: application/json" \
    -d '{"identity":"admin@example.com","password":"adminpassword"}' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))' 2>/dev/null)

if [ -n "$TOKEN" ]; then
    if ! curl -fsS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8090/api/collections/gallery >/dev/null 2>&1; then
        curl -fsS -X POST http://127.0.0.1:8090/api/collections \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{
                "name": "gallery",
                "type": "base",
                "fields": [
                    {
                        "name": "image",
                        "type": "file",
                        "required": true,
                        "options": {
                            "maxSelect": 1,
                            "maxSize": 5242880,
                            "mimeTypes": ["image/jpeg", "image/png", "image/webp"],
                            "thumbs": ["100x100"]
                        }
                    }
                ]
            }' >/dev/null 2>&1 || true
    fi
fi

exec "$@"
