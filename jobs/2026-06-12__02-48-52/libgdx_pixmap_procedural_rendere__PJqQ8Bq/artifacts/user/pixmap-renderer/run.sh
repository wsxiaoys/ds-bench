#!/bin/bash
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <input_file> <output_png>"
    exit 1
fi

gradle --no-daemon --offline run --args="'$1' '$2'" -q
