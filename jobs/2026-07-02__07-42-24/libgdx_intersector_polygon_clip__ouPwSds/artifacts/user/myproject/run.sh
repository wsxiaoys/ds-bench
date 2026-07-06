#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 <script-file>"
    exit 1
fi

# Get the absolute path of the script file
SCRIPT_PATH=$(realpath "$1")

# Navigate to the project root directory where run.sh is located
cd "$(dirname "$0")"

# Execute gradle run with quiet flag to suppress Gradle logging
./gradlew -q run --args="$SCRIPT_PATH"
