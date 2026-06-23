import os
import shutil
import socket
import pytest

def test_node_available():
    assert shutil.which("node") is not None, "Node.js is not installed."
    assert shutil.which("npm") is not None, "npm is not installed."

def test_port_8765_available():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        # If connect_ex returns 0, it means the port is in use
        result = sock.connect_ex(('127.0.0.1', 8765))
        assert result != 0, "Port 8765 is already in use, it should be available for the task."
    finally:
        sock.close()
