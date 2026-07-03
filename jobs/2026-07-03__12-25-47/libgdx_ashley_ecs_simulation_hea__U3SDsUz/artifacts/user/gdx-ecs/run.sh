#!/usr/bin/env bash
# Entry point for the deterministic Ashley ECS simulation.
# Usage: run.sh <scenario-file>
#
# Only the simulation's stdout is propagated to the caller.  All Gradle
# build noise is suppressed so a grader can diff the output verbatim.

set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

if [ "$#" -lt 1 ]; then
    echo "usage: run.sh <scenario-file>" >&2
    exit 2
fi

SCENARIO="$1"

# Use `gradle -q` so Gradle itself stays silent, then route gradle's own
# stderr to /dev/null as belt-and-suspenders.  The Java program Gradle
# launches inherits the parent process's stdout, so our System.out calls
# land in the captured temp file.
gradle -q --console=plain run --args="\"${SCENARIO}\"" \
    2>/tmp/gdx_ecs_gradle.err \
    >/tmp/gdx_ecs_stdout.tmp
status=$?

if [ "$status" -ne 0 ]; then
    cat /tmp/gdx_ecs_gradle.err >&2 || true
    cat /tmp/gdx_ecs_stdout.tmp >&2 || true
    rm -f /tmp/gdx_ecs_gradle.err /tmp/gdx_ecs_stdout.tmp
    exit "$status"
fi

cat /tmp/gdx_ecs_stdout.tmp
rm -f /tmp/gdx_ecs_gradle.err /tmp/gdx_ecs_stdout.tmp
exit 0
