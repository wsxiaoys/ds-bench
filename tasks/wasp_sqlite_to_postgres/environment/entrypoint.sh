#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Start the local PostgreSQL server so it is available to both the task
# executor and the verifier (SQLite -> PostgreSQL migration task).
mkdir -p /var/run/postgresql
chown postgres:postgres /var/run/postgresql 2>/dev/null || true
pg_ctlcluster 16 main start >/dev/null 2>&1 || true

exec "$@"
