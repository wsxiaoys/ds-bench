import shutil
import socket
import pytest

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_port_available():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        assert s.connect_ex(("localhost", 5732)) != 0, "Port 5732 is already in use."