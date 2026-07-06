#!/usr/bin/env bash
# Launcher for the libGDX headless projectile simulation.
# Receives: --scenario <scenario_path> --output <output_path>

set -eu

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Forward all arguments to the Gradle application runner.
exec ./gradlew --no-daemon -q :headless:run --args="$*"
