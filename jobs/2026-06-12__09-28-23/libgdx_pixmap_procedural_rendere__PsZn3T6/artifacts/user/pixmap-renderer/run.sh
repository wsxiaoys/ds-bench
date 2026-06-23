#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: bash run.sh <input_file> <output_png>" >&2
  exit 2
fi

gradle --no-daemon --offline --quiet render -PinputFile="$1" -PoutputFile="$2"
