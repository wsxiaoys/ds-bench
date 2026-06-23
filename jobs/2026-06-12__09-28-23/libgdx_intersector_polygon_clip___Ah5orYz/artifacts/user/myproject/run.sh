#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"
./gradlew -q run --args="\"$SCRIPT_PATH\"" 2>&1
