import json
import os
import shutil

PROJECT_DIR = "/home/user/qwik-chat"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"Dependencies are not installed: {node_modules} does not exist."
    )


def test_qwik_city_installed_and_version():
    pkg_path = os.path.join(
        PROJECT_DIR, "node_modules", "@builder.io", "qwik-city", "package.json"
    )
    assert os.path.isfile(pkg_path), (
        "@builder.io/qwik-city is not installed in the project's node_modules."
    )
    with open(pkg_path) as f:
        data = json.load(f)
    version = str(data.get("version", ""))
    parts = version.split(".")
    assert len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit(), (
        f"Unexpected @builder.io/qwik-city version string: {version!r}."
    )
    major, minor = int(parts[0]), int(parts[1])
    assert major == 1 and minor >= 14, (
        f"Expected @builder.io/qwik-city version 1.x (1.14 or newer), got {version!r}."
    )


def test_qwik_core_installed():
    pkg_path = os.path.join(
        PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json"
    )
    assert os.path.isfile(pkg_path), (
        "@builder.io/qwik is not installed in the project's node_modules."
    )


def test_routes_directory_exists():
    routes_dir = os.path.join(PROJECT_DIR, "src", "routes")
    assert os.path.isdir(routes_dir), (
        f"Qwik City routes directory {routes_dir} does not exist."
    )
