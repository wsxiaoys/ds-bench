import os
import shutil
import socket
import pytest

PROJECT_DIR = "/home/user/tanstack-form-wizard"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"package.json not found in {PROJECT_DIR}."

def test_port_7345_available():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        assert s.connect_ex(('localhost', 7345)) != 0, "Port 7345 is already in use."
