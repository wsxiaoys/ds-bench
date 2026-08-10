import os
import shutil
import socket

import pytest

PROJECT_DIR = "/home/user/upload-gallery"
APP_PORT = 4813


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_large_png_exists():
    large_png_path = "/bootstrap/file_example_png_3mb.png"
    assert os.path.isfile(large_png_path), (
        f"Large PNG file {large_png_path} does not exist."
    )
    assert os.path.getsize(large_png_path) > 2097152, (
        f"Large PNG file {large_png_path} is too small (must be > 2 MiB)."
    )


def test_app_port_is_free():
    # The app must be started by the executor/verifier on this port later.
    # Before the task begins, nothing should be listening on it.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    try:
        result = sock.connect_ex(("127.0.0.1", APP_PORT))
    finally:
        sock.close()
    assert result != 0, (
        f"Port {APP_PORT} is already in use; it must be free before the task starts."
    )
