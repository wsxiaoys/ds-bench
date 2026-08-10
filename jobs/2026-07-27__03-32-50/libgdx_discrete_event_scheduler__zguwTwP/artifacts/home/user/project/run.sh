#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GRADLE_CMD="gradle"
if [ -x "./gradlew" ]; then
    GRADLE_CMD="./gradlew"
fi

"$GRADLE_CMD" --offline -q installDist

exec "build/install/des/bin/des" "$@"
