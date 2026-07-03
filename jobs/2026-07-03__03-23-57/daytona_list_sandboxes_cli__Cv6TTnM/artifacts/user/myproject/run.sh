#!/bin/bash
set -e

# Read run ID
RUN_ID=$(cat /logs/artifacts/run-id)
SANDBOX_NAME="lst-${RUN_ID}"

# Login
daytona login --api-key "$DAYTONA_API_KEY"

# Create sandbox
daytona create --name "$SANDBOX_NAME"

# List and save JSON
daytona list --format json > /home/user/myproject/sandboxes.json

# Extract ID and write summary log
SANDBOX_ID=$(jq -r --arg name "$SANDBOX_NAME" '.items[] | select(.name == $name) | .id' /home/user/myproject/sandboxes.json)
echo "Created: ${SANDBOX_NAME} with id ${SANDBOX_ID}" > /home/user/myproject/output.log
