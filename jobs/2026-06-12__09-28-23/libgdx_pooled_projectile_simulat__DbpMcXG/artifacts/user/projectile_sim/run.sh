#!/bin/bash
cd /home/user/projectile_sim
./gradlew --no-daemon -q :headless:run --args="$*"
