import shutil
import socket

def test_node_available():
    assert shutil.which("node") is not None, "Node.js binary not found in PATH."

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_port_is_free():
    port = 4782
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        result = s.connect_ex(("localhost", port))
        assert result != 0, f"Port {port} is already in use, but it should be free."
