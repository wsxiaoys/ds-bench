#!/bin/bash

REWARD=1

cd /home/user
pytest /tests/test_final_state.py -v
if [ $? -ne 0 ]; then
  REWARD=0
fi

mkdir -p /logs/verifier
echo $REWARD > /logs/verifier/reward.txt
