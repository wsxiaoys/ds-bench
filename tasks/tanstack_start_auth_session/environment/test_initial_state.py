import json
import os
import shutil
import socket

PROJECT_DIR = "/home/user/tanstack-auth"
REQUIRED_PORT = 8791


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_project_is_tanstack_start_app():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    for key in ("dependencies", "devDependencies"):
        section = data.get(key)
        if isinstance(section, dict):
            deps.update(section)
    assert "@tanstack/react-start" in deps, (
        "Expected the scaffolded project to depend on '@tanstack/react-start' "
        "(a TanStack Start React application)."
    )


def test_dependencies_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"Dependencies do not appear to be installed: {node_modules} is missing."
    )
    start_pkg = os.path.join(node_modules, "@tanstack", "react-start")
    assert os.path.isdir(start_pkg), (
        "Expected '@tanstack/react-start' to be installed under node_modules."
    )


def test_required_port_is_free():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", REQUIRED_PORT))
        except OSError as exc:
            raise AssertionError(
                f"Required port {REQUIRED_PORT} is not free before the task starts: {exc}"
            )
    finally:
        sock.close()
