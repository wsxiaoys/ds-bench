#!/usr/bin/env bash
# Launches the Typesense Visual Filter Chip Builder web server in the
# foreground on port 8080. Requires a Typesense server reachable at
# http://127.0.0.1:8108 (override with TYPESENSE_URL) with its API key
# available at /etc/typesense-api-key.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -d node_modules ]; then
  npm install
fi

exec node server.js
