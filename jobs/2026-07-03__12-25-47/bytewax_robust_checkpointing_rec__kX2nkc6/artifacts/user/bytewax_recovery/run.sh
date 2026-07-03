#!/usr/bin/env bash
# Usage: bash run.sh <input_file> <output_file> <recovery_dir>
set -euo pipefail

if [ "$#" -ne 3 ]; then
    echo "Usage: bash run.sh <input_file> <output_file> <recovery_dir>" >&2
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"
RECOVERY_DIR="$3"

mkdir -p "$RECOVERY_DIR"

# Initialize recovery partitions if they don't already exist (one worker).
if [ ! -f "$RECOVERY_DIR/partition-0.sqlite" ]; then
    python3 -m bytewax.recovery "$RECOVERY_DIR" 1
fi

cd /home/user/bytewax_recovery

python3 -m bytewax.run \
    -r "$RECOVERY_DIR" \
    -s 10 \
    -b 60 \
    "dataflow:build_flow(\"$INPUT_FILE\",\"$OUTPUT_FILE\")"
