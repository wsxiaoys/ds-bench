#!/usr/bin/env bash
# Entrypoint for the sliding-window z-score anomaly detection dataflow.
#
# Idempotent: safe to invoke repeatedly. On a clean state it will
# initialize the SQLite recovery partitions; on subsequent runs it
# will reuse the existing (already-initialized) partitions and let
# Bytewax resume/recover from them.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${PROJECT_DIR}"

OUTPUT_DIR="${PROJECT_DIR}/output"
RECOVERY_DIR="${PROJECT_DIR}/recovery"

mkdir -p "${OUTPUT_DIR}"
mkdir -p "${RECOVERY_DIR}"

# Initialize recovery partitions only if the directory is empty, i.e.
# this is a clean state. Re-running the initializer against an
# already-initialized directory would destroy prior recovery state,
# so we guard against that to keep this script idempotent.
if [ -z "$(ls -A "${RECOVERY_DIR}" 2>/dev/null)" ]; then
    python -m bytewax.recovery "${RECOVERY_DIR}" 1
fi

python -m bytewax.run dataflow:flow -r "${RECOVERY_DIR}" -s 1 -b 1

exit 0
