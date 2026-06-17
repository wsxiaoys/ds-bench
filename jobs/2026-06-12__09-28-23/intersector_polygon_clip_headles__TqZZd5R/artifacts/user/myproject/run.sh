#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

script_path="${1:-}"
exec ./gradlew --quiet --console=plain run --args="$script_path"
