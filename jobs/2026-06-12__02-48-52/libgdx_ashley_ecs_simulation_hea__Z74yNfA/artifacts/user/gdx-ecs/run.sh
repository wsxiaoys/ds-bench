#!/usr/bin/env bash
# run.sh – build (if needed) and execute the gdx-ecs simulation.
#
# Usage:
#   bash run.sh <scenario-file>
#
# Only the simulation output is written to stdout.
# All Gradle noise and JVM log lines go to stderr.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO="${1:?Usage: run.sh <scenario-file>}"

# Make the scenario path absolute so the JVM can always find it.
SCENARIO="$(cd "$(dirname "$SCENARIO")" && pwd)/$(basename "$SCENARIO")"

JAR="${SCRIPT_DIR}/build/libs/gdx-ecs.jar"

# Build the fat-jar only when the sources are newer than the jar.
if [[ ! -f "${JAR}" ]] || \
   find "${SCRIPT_DIR}/src" -newer "${JAR}" -name "*.java" | grep -q .; then
    (cd "${SCRIPT_DIR}" && ./gradlew jar -q 1>&2)
fi

# Run the simulation; route stderr to stderr, stdout is the simulation output.
exec java -jar "${JAR}" "${SCENARIO}"
