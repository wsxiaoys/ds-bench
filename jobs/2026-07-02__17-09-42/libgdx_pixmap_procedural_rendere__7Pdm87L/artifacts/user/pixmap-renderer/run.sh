#!/usr/bin/env bash
# Entrypoint for the libGDX headless pixmap renderer.
#
# Usage:
#   ./run.sh <input-script> <output-png>
#
# Expects the project to be buildable with Gradle from a populated local cache
# (the Docker image pre-stages the libGDX 1.14.2 jars).

set -euo pipefail

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <input-script> <output-png>" >&2
    exit 2
fi

INPUT="$1"
OUTPUT="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIG_CWD="$(pwd)"

# Resolve positional arguments to absolute paths BEFORE we cd anywhere, so the
# user's relative paths resolve against the directory they ran us from.
cd "${ORIG_CWD}"
INPUT_ABS="$(readlink -f -- "${INPUT}")"
OUTPUT_ABS="$(readlink -f -- "${OUTPUT}")"

if [ ! -f "${INPUT_ABS}" ]; then
    echo "Input script not found: ${INPUT_ABS}" >&2
    exit 3
fi

# Make sure the output's parent directory exists.
mkdir -p "$(dirname -- "${OUTPUT_ABS}")"

# Now switch to the project directory so Gradle can find the build scripts.
cd "${SCRIPT_DIR}"

# Pick a gradle launcher: prefer the generated gradlew if present, otherwise
# fall back to whatever gradle is on PATH (the Docker image ships a system
# gradle 8.10).
if [ -x "${SCRIPT_DIR}/gradlew" ]; then
    GRADLE_CMD=("${SCRIPT_DIR}/gradlew")
else
    GRADLE_CMD=("gradle")
fi

# --no-daemon and --offline so the launcher is fast and hermetic in CI.
"${GRADLE_CMD[@]}" \
    --no-daemon \
    --offline \
    --console=plain \
    -q \
    run \
    --args="${INPUT_ABS} ${OUTPUT_ABS}"
RC=$?
# Gradle's run task exits with code 1 on JVM failure, including the cases where
# our launcher fails with a script error (exit 3) or render error (exit 4).
# Translate that into a single consistent exit code.
if [ "${RC}" -ne 0 ]; then
    echo "Renderer failed (gradle rc=${RC}); see output above" >&2
    exit "${RC}"
fi
exit 0
