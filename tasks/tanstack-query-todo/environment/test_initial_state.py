import os
import shutil
import socket
import pytest

PROJECT_DIR = "/home/user/tanstack-query-todo"
PORT = 4821

def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_port_is_available():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # Returns 0 if the port is open (in use), error code otherwise
        result = s.connect_ex(('127.0.0.1', PORT))
        assert result != 0, f"Port {PORT} is already in use, but it should be available for the task."
