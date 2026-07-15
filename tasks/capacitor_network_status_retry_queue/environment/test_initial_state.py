import json
import os
import shutil

PROJECT_DIR = "/home/user/network-queue-app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_lists_capacitor_network():
    package_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_path), f"{package_path} does not exist."
    with open(package_path) as f:
        pkg = json.load(f)
    deps = {}
    for key in ("dependencies", "devDependencies"):
        section = pkg.get(key)
        if isinstance(section, dict):
            deps.update(section)
    assert "@capacitor/network" in deps, (
        "Expected '@capacitor/network' to be listed in the project's dependencies."
    )


def test_capacitor_network_installed_offline():
    module_dir = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "network")
    assert os.path.isdir(module_dir), (
        "Expected '@capacitor/network' to be pre-installed under node_modules "
        "(the runtime environment has no internet access)."
    )
