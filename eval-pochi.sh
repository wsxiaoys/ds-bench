#!/usr/bin/env bash

MODEL="google/gemini-3.5-flash"

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --model MODEL_NAME   Specify the model to use (default: google/gemini-3.5-flash)"
    echo "  -h, --help           Show this help message"
    exit 1
}

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --model) MODEL="$2"; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown parameter passed: $1"; usage ;;
    esac
    shift
done

# check if zealt agent folder exists, if not, clone it
if [ ! -d "agent" ]; then
    git clone https://github.com/zwpaper/zealt-agent.git agent
fi

harbor run \
    --agent-import-path agent.pochi:Pochi \
    --mounts '[{"type": "bind","source":"test_initial_state.py","target":"/bootstrap/test_initial_state.py"}]' \
    --extra-docker-compose ./extra-compose.yml \
    --model "$MODEL" \
    -p ./tasks
