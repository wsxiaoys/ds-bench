#!/bin/bash
# Start script for Knowledge-Base Search Web App
# Ensure Typesense collection is initialized/indexed
python3 /home/user/kbsearch/index.py

# Start the Flask web server in the foreground
python3 /home/user/kbsearch/app.py
