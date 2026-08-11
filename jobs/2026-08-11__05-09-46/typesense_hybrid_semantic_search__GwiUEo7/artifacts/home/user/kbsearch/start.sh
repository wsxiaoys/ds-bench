#!/bin/bash
set -e

# Make sure we are in the project directory
cd /home/user/kbsearch

# Run the indexing script to populate the Typesense collection
echo "Indexing documents into Typesense..."
node /home/user/kbsearch/index.js

# Start the Node.js web server
echo "Starting web server..."
exec node /home/user/kbsearch/server.js
