#!/usr/bin/env bash
# Wrapper that forwards the script path to the libGDX headless launcher and
# emits only the program's stdout lines (no Gradle banner / progress noise).
set -e

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <script-file>" >&2
    exit 1
fi

SCRIPT_FILE="$1"

# Resolve project root from this script's directory so it works regardless of
# the caller's current working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# -q suppresses Gradle's INFO-level logging. We still capture stdout/stderr so
# any unexpected Gradle output is hidden, leaving only the launcher's result
# lines visible to the caller.
#
# We pass the script path both as a program argument (the standard convention
# mandated by the spec) and as a system property fallback so callers do not
# have to worry about path quoting through Gradle's --args tokenizer.
exec ./gradlew -q --console=plain run \
    --args "\"$SCRIPT_FILE\"" \
    -Dpolygon.script="$SCRIPT_FILE"