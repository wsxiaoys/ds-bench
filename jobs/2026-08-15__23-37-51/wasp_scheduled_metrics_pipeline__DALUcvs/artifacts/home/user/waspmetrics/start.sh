#!/bin/bash
set -e

echo "Starting PostgreSQL..."
service postgresql start

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432 -U waspuser; do
  sleep 1
done

echo "PostgreSQL is ready!"

echo "Applying database migrations..."
cd /home/user/waspmetrics
wasp db migrate-dev

echo "Starting Wasp app..."
exec wasp start
