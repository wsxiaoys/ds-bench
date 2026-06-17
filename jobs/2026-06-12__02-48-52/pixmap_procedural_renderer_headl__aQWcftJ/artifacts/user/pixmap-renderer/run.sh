#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run.sh — Procedural Pixmap Renderer entry point
#
# Usage:
#   bash run.sh <input-script> <output.png>
#
# Both paths are resolved relative to the caller's current working directory
# (converted to absolute so libGDX's Gdx.files.absolute() always finds them).
# ---------------------------------------------------------------------------

set -euo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: bash run.sh <input-script> <output.png>" >&2
    exit 1
fi

# Resolve the script directory so we can find the Gradle wrapper regardless
# of where the caller invokes this script from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Convert both paths to absolute so Gdx.files.absolute() works correctly
# when the JVM working directory differs from the caller's shell directory.
INPUT_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUTPUT_FILE="$(mkdir -p "$(dirname "$2")" && cd "$(dirname "$2")" && pwd)/$(basename "$2")"

cd "$SCRIPT_DIR"

# Use the Gradle wrapper if present; fall back to system gradle.
if [ -x "$SCRIPT_DIR/gradlew" ]; then
    GRADLE="$SCRIPT_DIR/gradlew"
else
    GRADLE="gradle"
fi

exec "$GRADLE" \
    --no-daemon \
    --offline \
    --quiet \
    --project-dir "$SCRIPT_DIR" \
    run \
    --args="$INPUT_FILE $OUTPUT_FILE"
