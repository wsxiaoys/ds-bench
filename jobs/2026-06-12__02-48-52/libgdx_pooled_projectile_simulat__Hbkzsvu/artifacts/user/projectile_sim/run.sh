#!/bin/bash
cd /home/user/projectile_sim
ARGS=""
for arg in "$@"; do
  ARGS="$ARGS \"$arg\""
done
./gradlew --no-daemon -q :headless:run --args="$ARGS"
