#!/bin/bash
set -e

# Run gradle installDist offline, redirecting stdout to stderr so stdout remains clean
./gradlew installDist --no-daemon --offline >&2

# Execute the application, forwarding the arguments
exec ./build/install/pixmap-renderer/bin/pixmap-renderer "$1" "$2"
