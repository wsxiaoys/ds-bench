#!/bin/bash
# Ensure we are in the project directory
cd /home/user/gdx-ecs

# Get absolute path of the scenario file
if [ -z "$1" ]; then
  echo "Usage: run.sh <scenario_path>" >&2
  exit 1
fi

SCENARIO_PATH=$(realpath "$1")

# Build the application quietly, redirecting stdout to stderr
gradle installDist -q >&2

# Run the installed application
./build/install/gdx-ecs/bin/gdx-ecs "$SCENARIO_PATH"
