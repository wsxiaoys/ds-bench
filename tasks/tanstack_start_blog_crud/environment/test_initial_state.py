import json
import os
import shutil
import socket

import pytest

PROJECT_DIR = "/home/user/blog"
APP_PORT = 43117


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_project_is_tanstack_start_scaffold():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "@tanstack/react-start" in deps, (
        "Expected @tanstack/react-start to be a dependency of the scaffolded project."
    )


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"node_modules not found at {node_modules}; project dependencies should be pre-installed."
    )


def test_app_port_is_free():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", APP_PORT))
    except OSError as exc:
        pytest.fail(f"Port {APP_PORT} is expected to be free but could not be bound: {exc}")
    finally:
        sock.close()
