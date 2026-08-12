#!/bin/bash

# Generate RUN_ID
RUN_ID="zr$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

# Per instruction.md, a PocketBase backend with a pre-seeded test user
# (test@example.com / secure_password) is expected to already be running at
# http://127.0.0.1:8090 before the agent starts. The test user data was
# baked into /home/user/pb_data at image build time (see Dockerfile); start
# the server against that data dir here — not in test_initial_state.py,
# which must only assert this state.
nohup pocketbase serve --http="127.0.0.1:8090" --dir=/home/user/pb_data >/tmp/pocketbase.log 2>&1 &
disown

exec "$@"
