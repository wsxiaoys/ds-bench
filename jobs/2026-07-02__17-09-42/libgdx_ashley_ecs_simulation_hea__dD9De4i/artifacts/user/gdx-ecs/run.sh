#!/usr/bin/env bash
# Deterministic-Ashley-ECS simulation runner.
#
# Usage: ./run.sh <scenario-file>
#
# Strategy:
#   1. Build the runnable distribution (`gradle -q installDist`) and send ALL of Gradle's
#      output to the caller's stderr (or, on failure, surface a short message and exit non-zero).
#      Nothing from Gradle ever appears on the caller's stdout.
#   2. `exec` the generated launcher (under build/install/gdx-ecs/bin/) so the JVM inherits the
#      caller's stdout verbatim. The Java program prints a single self-contained report to stdout
#      and exits 0 on success.
#
# Because we `exec` the launcher, the program's exit status is the script's exit status.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "$SCRIPT_DIR"

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <scenario-file>" >&2
    exit 2
fi

SCENARIO="$1"
if [[ ! -f "$SCENARIO" ]]; then
    echo "Scenario file not found: $SCENARIO" >&2
    exit 2
fi

# Resolve to an absolute path. The Java program uses Gdx.files.absolute(...) to read the file,
# so this keeps it robust regardless of the caller's working directory.
ABS_SCENARIO="$(cd -- "$(dirname -- "$SCENARIO")" &>/dev/null && pwd)/$(basename -- "$SCENARIO")"

# Build the runnable distribution in quiet mode. ALL Gradle chatter goes to the script's stderr
# so it never ends up on the user's stdout.
if ! gradle -q installDist 1>&2; then
    echo "Gradle installDist failed -- see messages above on stderr." >&2
    exit 1
fi

# `installDist` lays out the distribution under build/install/<rootProject.name>/. The launcher
# script name matches the project name (configured in settings.gradle).
LAUNCHER="$SCRIPT_DIR/build/install/gdx-ecs/bin/gdx-ecs"
if [[ ! -x "$LAUNCHER" ]]; then
    echo "Launcher not found or not executable: $LAUNCHER" >&2
    exit 1
fi

# Exec replaces this shell with the launcher; its stdout (which is the simulation report) flows
# straight through to the caller's stdout. Its exit code becomes our exit code (modulo set -e).
exec "$LAUNCHER" "$ABS_SCENARIO"
