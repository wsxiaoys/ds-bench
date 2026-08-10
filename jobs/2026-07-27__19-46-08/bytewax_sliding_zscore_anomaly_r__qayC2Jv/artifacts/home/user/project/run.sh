#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/user/project"
RECOVERY_DIR="$PROJECT_DIR/recovery"
OUTPUT_DIR="$PROJECT_DIR/output"

# Clean output directory to ensure idempotent runs
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Initialize recovery partitions (idempotent — re-init if directory is missing or empty)
if [ ! -d "$RECOVERY_DIR" ] || [ -z "$(ls -A "$RECOVERY_DIR" 2>/dev/null)" ]; then
    rm -rf "$RECOVERY_DIR"
    mkdir -p "$RECOVERY_DIR"
    python3 -m bytewax.recovery "$RECOVERY_DIR" 1
fi

# Run the dataflow with recovery enabled
cd "$PROJECT_DIR"
python3 -m bytewax.run \
    -r "$RECOVERY_DIR" \
    -s 10 \
    -b 60 \
    -w 1 \
    dataflow
