import os
import shutil
import socket

def test_npm_available():
    assert shutil.which("npm") is not None, "npm command not found in PATH."

def test_node_available():
    assert shutil.which("node") is not None, "node command not found in PATH."

def test_port_6382_is_free():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # If connect_ex returns 0, the port is open (in use)
        result = s.connect_ex(('localhost', 6382))
        assert result != 0, "Port 6382 is already in use."