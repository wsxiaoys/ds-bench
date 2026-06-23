#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

./gradlew --no-daemon -q :headless:run --args="--scenario $2 --output $4"
