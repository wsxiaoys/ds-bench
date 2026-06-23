#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run.sh  –  Projectile simulation launcher
#
# Usage:
#   bash run.sh --scenario <scenario_file> --output <output_file>
#
# The script resolves its own directory so it can be invoked from any working
# directory, then delegates to the :headless:run Gradle task, passing all
# received arguments straight through to the Java main class.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Forward every argument to the Java launcher as a single --args string.
# Gradle splits the value on spaces, so this correctly produces the four
# tokens  --scenario <path> --output <path>  that ProjectileLauncher expects.
exec ./gradlew --no-daemon -q :headless:run --args="$*"
