#!/usr/bin/env bash
set -euo pipefail

SCENARIO="$1"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$PROJECT_DIR"

# Build quietly, route all build output to stderr
./gradlew -q fatJar 1>&2

# Run the jar, only stdout goes through
java -jar build/libs/gdx-ecs.jar "$SCENARIO"
