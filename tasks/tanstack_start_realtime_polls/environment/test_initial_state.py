import shutil
import socket

APP_PORT = 4519


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_app_port_is_free():
    # The app must be started on port 4519 by the executor's solution.
    # Before evaluation begins nothing should be listening on it.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        result = sock.connect_ex(("127.0.0.1", APP_PORT))
        assert result != 0, (
            f"Port {APP_PORT} is already in use before the task starts; "
            "it must be free so the polling app can bind to it."
        )
    finally:
        sock.close()
