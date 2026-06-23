import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_node_binary_available():
    assert shutil.which("node") is not None, "Node.js binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_server_file_exists():
    server_path = os.path.join(PROJECT_DIR, "server.ts")
    assert os.path.isfile(server_path), f"Server file {server_path} does not exist."

def test_package_json_exists():
    package_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_path), f"Package file {package_path} does not exist."
