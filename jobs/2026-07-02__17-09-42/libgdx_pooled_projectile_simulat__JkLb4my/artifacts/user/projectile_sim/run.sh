#!/usr/bin/env bash
# Entry point invoked by the verifier.
#
# Usage:
#   ./run.sh --scenario <scenario_path> --output <output_path>
#
# Delegates to the :headless Gradle task via the project's gradle wrapper.
set -euo pipefail

# Resolve the directory that contains run.sh so we can locate the wrapper.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -x "./gradlew" ]]; then
    echo "run.sh: gradle wrapper not found in $SCRIPT_DIR" >&2
    exit 1
fi

# Forward every positional arg verbatim to the Gradle application plugin.
exec ./gradlew --no-daemon -q :headless:run --args="$*"
