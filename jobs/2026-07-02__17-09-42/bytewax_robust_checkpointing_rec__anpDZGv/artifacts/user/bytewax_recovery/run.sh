#!/usr/bin/env bash
# Entrypoint for the bytewax running-max pipeline.
#
# Usage: bash run.sh <input_file> <output_file> <recovery_dir>
#
# Behaviour:
#   * Initialises a local SQLite-based recovery directory on first run
#     (creating one empty recovery partition is enough for a single
#     worker, local-mode execution).
#   * Invokes ``python -m bytewax.run`` against ``flow.py``,
#     instantiating the dataflow via ``flow:get_flow(<input>, <output>)``
#     so the input/output file paths are passed in as literals.
#   * Wires up local-mode execution (``-w 1``) together with the
#     required recovery flags ``-r <recovery_dir>``, ``-s <snapshot>``
#     and ``-b <backup>`` so the dataflow's running-max state is
#     persisted between invocations.

set -euo pipefail

if [[ "$#" -ne 3 ]]; then
    echo "Usage: bash $0 <input_file> <output_file> <recovery_dir>" >&2
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"
RECOVERY_DIR="$3"

# Resolve absolute paths so the dataflow and recovery store see stable
# paths regardless of the caller's working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INPUT_FILE="$(cd "$(dirname "$INPUT_FILE")" && pwd)/$(basename "$INPUT_FILE")"
OUTPUT_FILE="$(cd "$(dirname "$OUTPUT_FILE")" 2>/dev/null && pwd)/$(basename "$OUTPUT_FILE")" || \
    OUTPUT_FILE="$SCRIPT_DIR/$OUTPUT_FILE"
mkdir -p "$(dirname "$OUTPUT_FILE")"
RECOVERY_DIR="$(cd "$(dirname "$RECOVERY_DIR")" 2>/dev/null && pwd)/$(basename "$RECOVERY_DIR")" || \
    RECOVERY_DIR="$SCRIPT_DIR/$RECOVERY_DIR"

# Sanity-check the input file actually exists up front so we get a
# clean error message instead of a runtime error from Bytewax.
if [[ ! -f "$INPUT_FILE" ]]; then
    echo "Input file not found: $INPUT_FILE" >&2
    exit 1
fi

# Make sure the recovery directory exists and that it contains an
# initialised SQLite recovery partition.  ``init_db_dir`` is idempotent
# enough for our needs - if the directory already has partitions from a
# previous run we leave them alone.
mkdir -p "$RECOVERY_DIR"
if [[ -z "$(ls -A "$RECOVERY_DIR" 2>/dev/null)" ]]; then
    python3 -m bytewax.recovery "$RECOVERY_DIR" 1
fi

# Run the dataflow.  We use a single worker because we are running
# locally; the snapshot interval and backup interval chosen below are
# short enough to make the recovery semantics easy to reason about
# without flooding the recovery store with snapshots.
exec python3 -m bytewax.run \
    -w 1 \
    -r "$RECOVERY_DIR" \
    -s 10 \
    -b 60 \
    "$SCRIPT_DIR/flow.py:get_flow('$INPUT_FILE','$OUTPUT_FILE')"
