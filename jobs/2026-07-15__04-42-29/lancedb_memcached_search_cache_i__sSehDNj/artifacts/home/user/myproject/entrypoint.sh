#!/bin/bash
mkdir -p /logs/artifacts
RUN_ID="${ZEALT_RUN_ID:-}"
if [ -z "$RUN_ID" ]; then
  RUN_ID="$(cat /logs/artifacts/run-id 2>/dev/null || echo local)"
fi
export ZEALT_RUN_ID="$RUN_ID"

if ! pgrep -x memcached >/dev/null 2>&1; then
  memcached -d -u nobody -p 11211 -l 127.0.0.1 -m 64
fi

MARKER="/home/user/myproject/.seeded_${RUN_ID}"
if [ ! -f "$MARKER" ]; then
  python3 /home/user/myproject/_seed.py && touch "$MARKER"
fi

trap : TERM INT
sleep infinity & wait
