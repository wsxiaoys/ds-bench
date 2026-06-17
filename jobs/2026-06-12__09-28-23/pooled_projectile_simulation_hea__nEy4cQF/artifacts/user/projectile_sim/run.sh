#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 || "$1" != "--scenario" || "$3" != "--output" ]]; then
  echo "Usage: $0 --scenario <scenario_path> --output <output_path>" >&2
  exit 2
fi

SCENARIO_PATH="$2"
OUTPUT_PATH="$4"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"
exec ./gradlew --no-daemon -q :headless:run --args="--scenario ${SCENARIO_PATH} --output ${OUTPUT_PATH}"
