#!/bin/bash
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <input-script-path>"
    exit 1
fi

SCRIPT_PATH="$1"

cd "$(dirname "$0")"

exec ./gradlew run --args="$SCRIPT_PATH" -q --console=plain
