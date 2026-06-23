#!/bin/bash

# Use this file to install test dependencies and run the tests.
# It will be copied to /tests/test.sh and run from the working directory.

REWARD=1

pytest /tests/test_final_state.py -v
if [ $? -ne 0 ]; then
  REWARD=0
fi

mkdir -p /logs/verifier
echo $REWARD > /logs/verifier/reward.txt
