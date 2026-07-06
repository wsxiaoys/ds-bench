#!/bin/bash
set -e

# Verify correct number of arguments
if [ "$#" -ne 3 ]; then
    echo "Usage: bash run.sh <input_file> <output_file> <recovery_dir>" >&2
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"
RECOVERY_DIR="$3"

# Resolve paths to absolute paths
INPUT_FILE=$(realpath "$INPUT_FILE")
# Ensure the parent directory of OUTPUT_FILE exists
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
mkdir -p "$OUTPUT_DIR"
# Touch the output file so realpath can resolve it, or just resolve the parent dir
OUTPUT_FILE_NAME=$(basename "$OUTPUT_FILE")
OUTPUT_DIR_ABS=$(realpath "$OUTPUT_DIR")
OUTPUT_FILE="$OUTPUT_DIR_ABS/$OUTPUT_FILE_NAME"

# Create and resolve recovery directory
mkdir -p "$RECOVERY_DIR"
RECOVERY_DIR=$(realpath "$RECOVERY_DIR")

# Initialize recovery partitions if not already initialized
if ! ls "$RECOVERY_DIR"/*.sqlite3 &>/dev/null; then
    echo "Initializing recovery partitions in $RECOVERY_DIR..."
    python -m bytewax.recovery "$RECOVERY_DIR" 1
fi

# Export environment variables for the Bytewax python process
export INPUT_FILE="$INPUT_FILE"
export OUTPUT_FILE="$OUTPUT_FILE"

# Change to the directory of this script so python can find pipeline.py
SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

# Run the Bytewax dataflow
echo "Running Bytewax pipeline..."
python -m bytewax.run \
    -r "$RECOVERY_DIR" \
    -s 1 \
    -b 1 \
    pipeline:flow
