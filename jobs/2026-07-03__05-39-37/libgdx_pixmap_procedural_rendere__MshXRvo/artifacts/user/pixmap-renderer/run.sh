#!/usr/bin/env bash
#
# run.sh — shell entrypoint for the procedural pixmap renderer.
#
# Usage:
#   ./run.sh <input-command-file> <output-png-path>
#
# Boots a libGDX headless application, executes the drawing commands in the
# input script against a Pixmap, and writes the result to the output path as
# a PNG. All libGDX dependencies are already present in the local Gradle
# cache, so Gradle is invoked with --offline for speed and reproducibility.
#
set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input-command-file> <output-png-path>" >&2
    exit 2
fi

INPUT_FILE="$1"
OUTPUT_PNG="$2"

# Resolve an absolute path to the project root (where this script lives).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Resolve the input/output paths to absolute form so libGDX's
# Gdx.files.absolute(...) always finds them regardless of cwd.
INPUT_ABS="$INPUT_FILE"
OUTPUT_ABS="$OUTPUT_PNG"
if [[ "$INPUT_ABS" != /* ]]; then
    INPUT_ABS="$(pwd)/$INPUT_ABS"
fi
if [[ "$OUTPUT_ABS" != /* ]]; then
    OUTPUT_ABS="$(pwd)/$OUTPUT_ABS"
fi

# Prefer the bundled Gradle wrapper; fall back to a system gradle if present.
if [ -x "./gradlew" ]; then
    GRADLE_CMD="./gradlew"
else
    GRADLE_CMD="gradle"
fi

# Run the application, forwarding the two positional arguments to main(String[]).
# --no-daemon keeps the build self-contained in CI/server environments.
exec "$GRADLE_CMD" --no-daemon --offline run --args="$INPUT_ABS $OUTPUT_ABS"