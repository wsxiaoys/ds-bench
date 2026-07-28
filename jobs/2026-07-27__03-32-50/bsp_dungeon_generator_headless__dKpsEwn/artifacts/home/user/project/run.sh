#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <input_file> <output_dir>" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_FILE="$1"
OUTPUT_DIR="$2"

# Resolve to absolute paths so the working directory used for the build
# below does not affect where we read/write.
case "$INPUT_FILE" in
  /*) ;;
  *) INPUT_FILE="$(pwd)/$INPUT_FILE" ;;
esac
case "$OUTPUT_DIR" in
  /*) ;;
  *) OUTPUT_DIR="$(pwd)/$OUTPUT_DIR" ;;
esac

cd "$SCRIPT_DIR"

LAUNCHER="build/install/dungeon/bin/dungeon"

if [ ! -x "$LAUNCHER" ]; then
  gradle --offline -q installDist
fi

exec "$LAUNCHER" "$INPUT_FILE" "$OUTPUT_DIR"
