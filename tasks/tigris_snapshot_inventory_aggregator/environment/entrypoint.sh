#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Provision the six Tigris buckets (three "inv" buckets with snapshots, three
# unrelated "other" buckets) that this task's initial state requires. This
# must happen here — not inside test_initial_state.py — because the Tigris
# credentials are only available at container runtime, and the initial-state
# test must only assert on the environment, never mutate it.
PREFIX=$(printf 'harbor-inv-%s-' "$RUN_ID" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9.-]/-/g')
OTHER_X="harbor-other-${RUN_ID}-x"
OTHER_Y="harbor-other-${RUN_ID}-y"
OTHER_Z="harbor-other-${RUN_ID}-z"

export AWS_ACCESS_KEY_ID="${TIGRIS_STORAGE_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${TIGRIS_STORAGE_SECRET_ACCESS_KEY:-}"
export AWS_REGION="auto"
export AWS_DEFAULT_REGION="auto"

tigris configure \
    --access-key "${TIGRIS_STORAGE_ACCESS_KEY_ID:-}" \
    --access-secret "${TIGRIS_STORAGE_SECRET_ACCESS_KEY:-}" \
    --endpoint https://t3.storage.dev >/dev/null 2>&1 || true

for bucket in "${PREFIX}a" "${PREFIX}b" "${PREFIX}c" "$OTHER_X" "$OTHER_Y" "$OTHER_Z"; do
    tigris buckets delete "$bucket" --yes >/dev/null 2>&1 || true
done
sleep 3

# harbor-inv-*-a (2 snapshots)
tigris buckets create "${PREFIX}a" --enable-snapshots >/dev/null 2>&1 || true
tigris snapshots take "${PREFIX}a" "${PREFIX}a-s1" >/dev/null 2>&1 || true
sleep 1
tigris snapshots take "${PREFIX}a" "${PREFIX}a-s2" >/dev/null 2>&1 || true
sleep 1

# harbor-inv-*-b (1 snapshot)
tigris buckets create "${PREFIX}b" --enable-snapshots >/dev/null 2>&1 || true
tigris snapshots take "${PREFIX}b" "${PREFIX}b-s1" >/dev/null 2>&1 || true
sleep 1

# harbor-inv-*-c (3 snapshots)
tigris buckets create "${PREFIX}c" --enable-snapshots >/dev/null 2>&1 || true
tigris snapshots take "${PREFIX}c" "${PREFIX}c-s1" >/dev/null 2>&1 || true
sleep 1
tigris snapshots take "${PREFIX}c" "${PREFIX}c-s2" >/dev/null 2>&1 || true
sleep 1
tigris snapshots take "${PREFIX}c" "${PREFIX}c-s3" >/dev/null 2>&1 || true
sleep 1

# harbor-other-*-x (2 snapshots) — unrelated bucket that must NOT be touched by the agent
tigris buckets create "$OTHER_X" --enable-snapshots >/dev/null 2>&1 || true
tigris snapshots take "$OTHER_X" "${OTHER_X}-s1" >/dev/null 2>&1 || true
sleep 1
tigris snapshots take "$OTHER_X" "${OTHER_X}-s2" >/dev/null 2>&1 || true
sleep 1

# harbor-other-*-y / harbor-other-*-z (0 snapshots) — unrelated buckets
tigris buckets create "$OTHER_Y" >/dev/null 2>&1 || true
tigris buckets create "$OTHER_Z" >/dev/null 2>&1 || true

exec "$@"
