#!/usr/bin/env bash
# Weighted A* tilemap pathfinder runner.
#
# Usage: bash run.sh <scenario_path> <output_path>
#
# Builds the project (offline, using only locally-cached dependencies) the
# first time it is invoked, then (re)uses the resulting install every time.
# Safe to run repeatedly.
set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Usage: bash run.sh <scenario_path> <output_path>" >&2
    exit 2
fi

SCENARIO_PATH="$1"
OUTPUT_PATH="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LAUNCHER="$SCRIPT_DIR/build/install/astar/bin/astar"

if [ ! -x "$LAUNCHER" ]; then
    gradle --offline -q installDist
fi

exec "$LAUNCHER" "$SCENARIO_PATH" "$OUTPUT_PATH"
