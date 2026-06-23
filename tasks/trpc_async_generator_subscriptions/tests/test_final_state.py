import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_files_exist():
    assert os.path.isfile(os.path.join(PROJECT_DIR, "server.ts")), "server.ts not found."
    assert os.path.isfile(os.path.join(PROJECT_DIR, "client.ts")), "client.ts not found."

def test_server_uses_async_generator():
    with open(os.path.join(PROJECT_DIR, "server.ts")) as f:
        content = f.read()
    assert "async function*" in content or "async function *" in content, "server.ts does not use an async generator for the subscription."

def test_client_uses_http_subscription_link():
    with open(os.path.join(PROJECT_DIR, "client.ts")) as f:
        content = f.read()
    assert "httpSubscriptionLink" in content, "client.ts does not use httpSubscriptionLink."

def test_output_log_contains_countdown():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    
    assert os.path.isfile(log_path), "output.log not found. Did you run the client and redirect output to output.log?"
    
    with open(log_path) as f:
        content = f.read()
    assert "3" in content, "output.log does not contain 3"
    assert "2" in content, "output.log does not contain 2"
    assert "1" in content, "output.log does not contain 1"
    assert "0" in content, "output.log does not contain 0"
