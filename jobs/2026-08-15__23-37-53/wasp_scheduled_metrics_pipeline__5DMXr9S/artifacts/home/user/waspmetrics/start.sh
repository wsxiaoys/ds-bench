#!/bin/bash
set -e

echo "Starting PostgreSQL..."
service postgresql start

# Wait for PostgreSQL to be ready
until pg_isready -h localhost -p 5432; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 1
done

echo "PostgreSQL is ready!"

# Run database migrations
echo "Running database migrations..."
cd /home/user/waspmetrics
wasp db migrate-dev

# Start Wasp application
echo "Starting Wasp application..."
exec wasp start
