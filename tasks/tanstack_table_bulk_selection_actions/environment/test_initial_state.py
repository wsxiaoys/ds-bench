import os
import shutil
import socket

import pytest

PROJECT_DIR = "/home/user/app"
NODE_MODULES = os.path.join(PROJECT_DIR, "node_modules")
PORT = 34517

# Dependencies that MUST be pre-installed offline so the executor can build and
# run the app without any network access at evaluation time.
REQUIRED_PACKAGES = [
    "react",
    "react-dom",
    "@tanstack/react-table",
    "@tanstack/react-query",
    "express",
    "better-sqlite3",
    "vite",
    "typescript",
]


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_node_modules_installed():
    assert os.path.isdir(NODE_MODULES), (
        f"{NODE_MODULES} does not exist; dependencies must be pre-installed offline."
    )


@pytest.mark.parametrize("package", REQUIRED_PACKAGES)
def test_required_package_present(package):
    package_path = os.path.join(NODE_MODULES, *package.split("/"))
    assert os.path.isdir(package_path), (
        f"Required dependency '{package}' is not installed at {package_path}."
    )


def test_target_port_is_free():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    try:
        result = sock.connect_ex(("127.0.0.1", PORT))
    finally:
        sock.close()
    assert result != 0, (
        f"Port {PORT} is already in use before the task starts; it must be free."
    )
