import shutil
import socket

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_port_3145_is_free():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        result = s.connect_ex(('localhost', 3145))
        assert result != 0, "Port 3145 is already in use. It should be free for the task."
