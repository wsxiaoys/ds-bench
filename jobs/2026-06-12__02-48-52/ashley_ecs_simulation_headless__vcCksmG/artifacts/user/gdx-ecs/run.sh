#!/bin/bash
cd /home/user/gdx-ecs
gradle run -q --args="$1" 2>/dev/null
