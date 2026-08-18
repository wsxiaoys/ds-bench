#!/bin/bash
set -e

# 1. Start PostgreSQL server if not already running
if ! service postgresql status > /dev/null 2>&1; then
    echo "Starting PostgreSQL..."
    service postgresql start
fi

# Wait for PostgreSQL to be ready
until pg_isready -h localhost -p 5432 > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL to start..."
    sleep 1
done

echo "PostgreSQL is ready."

# 2. Run migrations
echo "Running database migrations..."
cd /home/user/waspmetrics
wasp db migrate-dev --name "init"

# 3. Start Wasp application in foreground
echo "Starting Wasp application..."
exec wasp start
