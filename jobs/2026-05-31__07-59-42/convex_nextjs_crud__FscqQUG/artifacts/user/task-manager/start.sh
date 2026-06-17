#!/bin/bash
# Map ZEALT_RUN_ID to NEXT_PUBLIC_ZEALT_RUN_ID
export NEXT_PUBLIC_ZEALT_RUN_ID="${ZEALT_RUN_ID:-default}"

# Map CONVEX_URL to NEXT_PUBLIC_CONVEX_URL if CONVEX_URL is set
if [ -n "$CONVEX_URL" ]; then
  export NEXT_PUBLIC_CONVEX_URL="$CONVEX_URL"
fi

exec next dev -p 3000