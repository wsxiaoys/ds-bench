#!/usr/bin/env bash

MODEL="google/gemini-3.5-flash"
CONCURRENCY=5

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --model MODEL_NAME    Specify the model to use (default: google/gemini-3.5-flash)"
    echo "  --concurrency NUMBER  Specify the number of concurrently evaluate tasks (default: 5)"
    echo "  -h, --help            Show this help message"
    echo "  All other arguments are passed directly to harbor run"
    exit 1
}

EXTRA_ARGS=()

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --model) MODEL="$2"; shift ;;
        --concurrency) CONCURRENCY="$2"; shift ;;
        -h|--help) usage ;;
        *) EXTRA_ARGS+=("$1") ;;
    esac
    shift
done

export PYTHONPATH="$(dirname "$0"):${PYTHONPATH}"

harbor run \
       --yes \
       --artifact /home/user \
       --agent-import-path python.pochi:Pochi \
       --mounts '[{"type": "bind","source":"test_initial_state.py","target":"/bootstrap/test_initial_state.py"}]' \
       --extra-docker-compose ./.zealt/extra-docker-compose.yml \
       --agent-env POCHI_API_KEY="${POCHI_API_KEY}" \
       --n-concurrent "$CONCURRENCY" \
       --model "$MODEL" \
       -p ./tasks \
       "${EXTRA_ARGS[@]}"
