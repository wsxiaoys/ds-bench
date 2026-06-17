import socket
import shutil

def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_port_5123_available():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # Returns 0 if successful (meaning port is in use), error code otherwise
        result = s.connect_ex(('localhost', 5123))
        assert result != 0, "Port 5123 is already in use, but it should be available for the task."
