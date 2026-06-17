import shutil
import socket
import pytest

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_port_8234_is_free():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        result = s.connect_ex(('localhost', 8234))
        # If result is 0, the port is in use. We want it to be not 0.
        assert result != 0, "Port 8234 is already in use. It should be free for the task."
