import os
import shutil
import socket

PROJECT_DIR = "/home/user/project"
PORT = 34517


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_port_available():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        result = sock.connect_ex(("127.0.0.1", PORT))
        assert result != 0, f"Port {PORT} is already in use. It should be available."
    finally:
        sock.close()
