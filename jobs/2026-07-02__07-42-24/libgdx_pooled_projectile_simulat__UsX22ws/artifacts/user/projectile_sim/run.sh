#!/bin/bash
cd /home/user/projectile_sim
exec ./gradlew --no-daemon -q :headless:run --args="$*"
