#!/bin/bash
set -e

echo "Starting PostgreSQL..."
# Start PostgreSQL database server
/etc/init.d/postgresql start || service postgresql start

# Wait for PostgreSQL to be completely ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432; do
  echo "PostgreSQL is not ready yet, sleeping 1s..."
  sleep 1
done
echo "PostgreSQL is ready!"

# Apply migrations
echo "Running database migrations..."
cd /home/user/waspmetrics
wasp db migrate-dev --name init

# Start the Wasp application
echo "Starting Wasp application..."
exec wasp start
