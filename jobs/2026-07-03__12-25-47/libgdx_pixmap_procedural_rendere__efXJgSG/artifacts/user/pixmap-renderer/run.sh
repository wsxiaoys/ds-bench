#!/usr/bin/env bash
# Entry point for the procedural pixmap renderer.
# Usage: run.sh <input-script> <output-png>
set -euo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <input-script> <output-png>" >&2
    exit 2
fi

INPUT="$1"
OUTPUT="$2"

cd "$(dirname "$0")"

if [ ! -f "$INPUT" ]; then
    echo "Input file does not exist: $INPUT" >&2
    exit 1
fi

# Resolve to absolute paths so the JVM can find them regardless of cwd.
ABS_INPUT="$(readlink -f "$INPUT")"
ABS_OUTPUT="$(readlink -f "$OUTPUT")"

mkdir -p "$(dirname "$ABS_OUTPUT")"

exec gradle --no-daemon --offline -q run --args="$ABS_INPUT $ABS_OUTPUT"
