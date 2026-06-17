import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_client_ts_exists():
    client_ts_path = os.path.join(PROJECT_DIR, "client.ts")
    assert os.path.isfile(client_ts_path), f"File {client_ts_path} does not exist."

def test_server_ts_exists():
    server_ts_path = os.path.join(PROJECT_DIR, "server.ts")
    assert os.path.isfile(server_ts_path), f"File {server_ts_path} does not exist."

def test_initial_transformer_config():
    client_ts_path = os.path.join(PROJECT_DIR, "client.ts")
    with open(client_ts_path) as f:
        content = f.read()
    assert "transformer: superjson" in content and "httpBatchLink" in content, \
        "Expected initial client.ts to contain transformer: superjson at the root."
