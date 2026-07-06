#!/usr/bin/env bash
#
# run.sh - Deterministic Ashley ECS simulation entry point.
#
# Usage: ./run.sh <scenario-file>
#
# Prints ONLY the simulation output to stdout. All Gradle progress noise, log
# lines, and other chatter are routed to stderr so stdout stays clean.

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <scenario-file>" >&2
    exit 2
fi

SCENARIO_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve an absolute path for the scenario file so Gdx.files.absolute works
# regardless of the working directory Gradle uses.
if [[ "$SCENARIO_FILE" = /* ]]; then
    ABS_SCENARIO="$SCENARIO_FILE"
else
    ABS_SCENARIO="$(pwd)/$SCENARIO_FILE"
fi

cd "$SCRIPT_DIR"

# Run the Gradle application in quiet mode. Gradle progress and any logging
# the build emits goes to stderr; the program's own stdout (the simulation
# output) flows through to stdout untouched.
exec gradle -q run --args="$ABS_SCENARIO"