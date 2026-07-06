#!/usr/bin/env bash
set -euo pipefail

# Project Directory
PROJECT_DIR="/home/user/myproject"
cd "$PROJECT_DIR"

# 1. Ensure pb_migrations directory exists
mkdir -p pb_migrations

# 2. Write migration file for tasks collection
cat << 'EOF' > pb_migrations/1700000000_create_tasks.js
migrate((app) => {
  let collection = new Collection({
    type: "base",
    name: "tasks",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "done",
        type: "bool",
      },
      {
        name: "due",
        type: "date",
      },
    ],
  });

  app.save(collection);
}, (app) => {
  let collection = app.findCollectionByNameOrId("tasks");
  app.delete(collection);
});
EOF

# 3. Create or update superuser
echo "Creating/upserting superuser..."
./pocketbase superuser upsert admin@example.com Adm1n_passw0rd!

# 4. Apply migrations
echo "Applying migrations..."
./pocketbase migrate up

# 5. Start PocketBase server in background if not already running
echo "Checking if PocketBase server is running..."
if ! curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8090/api/health | grep -q "200"; then
  echo "Starting PocketBase server in the background..."
  nohup ./pocketbase serve --dir ./pb_data > pocketbase.log 2>&1 &
  
  # Wait for server to start and respond to health check
  echo "Waiting for PocketBase to start..."
  for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8090/api/health | grep -q "200"; then
      echo "PocketBase is healthy and running!"
      break
    fi
    sleep 1
  done
else
  echo "PocketBase is already running."
fi

# 6. Authenticate as superuser to get REST API token
echo "Authenticating as superuser..."
TOKEN=$(curl -s -X POST http://127.0.0.1:8090/api/collections/_superusers/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity": "admin@example.com", "password": "Adm1n_passw0rd!"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "Error: Failed to authenticate superuser." >&2
  exit 1
fi

# 7. Seed tasks idempotently
TASKS=(
  "Buy groceries"
  "Walk the dog"
  "Read a book"
  "Write weekly report"
  "Call mom"
)

echo "Seeding tasks..."
for task in "${TASKS[@]}"; do
  # Check if the task already exists in the tasks collection
  COUNT=$(curl -s -G http://127.0.0.1:8090/api/collections/tasks/records \
    -H "Authorization: $TOKEN" \
    --data-urlencode "filter=title=\"$task\"" | jq '.totalItems')
  
  if [[ "$COUNT" =~ ^[0-9]+$ ]] && [ "$COUNT" -gt 0 ]; then
    echo "Task already exists: $task"
  else
    echo "Seeding task: $task"
    curl -s -X POST http://127.0.0.1:8090/api/collections/tasks/records \
      -H "Authorization: $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"title\": \"$task\"}" > /dev/null
  fi
done

echo "Setup completed successfully."
exit 0
