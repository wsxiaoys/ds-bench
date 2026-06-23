#!/usr/bin/env bash
# run.sh — headless libGDX geometry CLI launcher
#
# Usage:  bash run.sh <script-file-path>
#
# All Gradle banners, progress lines, and daemon notices are suppressed;
# only the program's own stdout lines reach the caller's stdout.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <script-file-path>" >&2
    exit 1
fi

SCRIPT_FILE="$1"

# Build the fat-jar once (no-op on subsequent runs if nothing changed).
# stderr from Gradle goes to /dev/stderr so build errors are still visible,
# but no Gradle output leaks to stdout.
"${SCRIPT_DIR}/gradlew" -q -p "${SCRIPT_DIR}" jar 2>/dev/null

# Run the fat-jar directly — no Gradle overhead, no banners on stdout.
exec java -Djava.awt.headless=true \
     -jar "${SCRIPT_DIR}/build/libs/gdx-geom-cli-1.0.jar" \
     "${SCRIPT_FILE}"
