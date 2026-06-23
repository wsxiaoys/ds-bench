import os
import shutil
import socket
import pytest

PROJECT_DIR = "/home/user/ecommerce-cart"

def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_port_8432_is_available():
    port = 8432
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # returns 0 if connection succeeds (meaning port is in use)
        # returns error code if connection fails (meaning port is available)
        result = s.connect_ex(('localhost', port))
        assert result != 0, f"Port {port} is already in use, it must be available for the task."
