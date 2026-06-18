import shutil
import socket

def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_port_4821_is_available():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        result = s.connect_ex(('localhost', 4821))
        # connect_ex returns 0 if the port is open (i.e., in use)
        assert result != 0, "Port 4821 is already in use, expected it to be available."
