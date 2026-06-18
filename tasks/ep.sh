#!/usr/bin/env bash
set -euo pipefail

find . -type f -name Dockerfile | while read -r dockerfile; do
    dir="$(dirname "$dockerfile")"
    entrypoint="$dir/entrypoint.sh"

    cat > "$entrypoint" <<'EOF'
#!/bin/bash

# Generate RUN_ID
RUN_ID="zr-$(tr -dc 'a-z0-9' < /dev/urandom | head -c 8)"
mkdir -p /logs/artifacts
echo "$RUN_ID" > /logs/artifacts/run-id

exec "$@"
EOF

    chmod +x "$entrypoint"

    echo "Created $entrypoint"
done