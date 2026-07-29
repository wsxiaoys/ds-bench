#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Per instruction.md, the Typesense server is expected to already be running
# before the agent starts. Bring it up here (not in test_initial_state.py) so
# the initial-state test only has to assert this fact rather than make it
# true itself.
/usr/local/bin/start-typesense.sh || true

exec "$@"
