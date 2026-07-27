#!/bin/bash
set -e

# Change directory to the directory where this script resides
cd "$(dirname "$0")"

echo "Setting up Prefect scheduling lab deployments..."
python3 deploy.py
echo "Done!"
