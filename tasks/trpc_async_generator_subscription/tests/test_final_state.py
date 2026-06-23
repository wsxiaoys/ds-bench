import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_output_log_contains_countdown():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert os.path.isfile(log_path), f"Log file {log_path} does not exist."
    
    with open(log_path) as f:
        content = f.read().strip().split('\n')
    
    # Check if the output contains 3, 2, 1 in that order
    numbers = [line.strip() for line in content if line.strip() in ['1', '2', '3']]
    assert numbers == ['3', '2', '1'], f"Expected output log to contain 3, 2, 1 in order, got: {numbers}"

def test_server_ts_uses_async_generator():
    server_path = os.path.join(PROJECT_DIR, "server.ts")
    assert os.path.isfile(server_path), f"Server file {server_path} does not exist."
    
    with open(server_path) as f:
        content = f.read()
    
    assert "publicProcedure.subscription(async function*" in content or "publicProcedure.subscription(async function *" in content, \
        "Expected server.ts to use 'publicProcedure.subscription(async function*' for the subscription."
