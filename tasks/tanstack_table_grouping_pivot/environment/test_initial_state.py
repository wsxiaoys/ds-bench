import shutil
import socket

import pytest

APP_PORT = 5319


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_app_port_is_free():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    try:
        result = sock.connect_ex(("127.0.0.1", APP_PORT))
        # A non-zero result means the connection failed, i.e. nothing is
        # listening on the port yet, which is the expected initial state.
        assert result != 0, (
            f"Port {APP_PORT} is already in use before the task starts; "
            "it must be free so the app can bind to it."
        )
    finally:
        sock.close()
