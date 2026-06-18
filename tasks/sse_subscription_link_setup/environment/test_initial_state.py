import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"File {pkg_path} does not exist."

def test_server_ts_exists():
    server_path = os.path.join(PROJECT_DIR, "server.ts")
    assert os.path.isfile(server_path), f"File {server_path} does not exist."

def test_client_ts_exists():
    client_path = os.path.join(PROJECT_DIR, "client.ts")
    assert os.path.isfile(client_path), f"File {client_path} does not exist."

def test_node_modules_exists():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), f"Directory {node_modules} does not exist. Dependencies not installed."
