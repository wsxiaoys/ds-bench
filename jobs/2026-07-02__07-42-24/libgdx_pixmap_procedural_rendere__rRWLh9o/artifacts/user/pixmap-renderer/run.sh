#!/bin/bash
set -e

# Ensure we have two arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input_file> <output_file>"
    exit 1
fi

# Get absolute paths of the arguments
INPUT_PATH=$(realpath "$1")
OUTPUT_PATH=$(realpath "$2")

# Navigate to the project directory
cd /home/user/pixmap-renderer

# Run gradle with offline mode and forward the arguments
./gradlew -g /home/user/.gradle --no-daemon --offline run --args="$INPUT_PATH $OUTPUT_PATH"
