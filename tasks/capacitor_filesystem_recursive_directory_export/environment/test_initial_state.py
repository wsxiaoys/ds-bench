import json
import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_declares_capacitor_deps():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@capacitor/core" in deps, "@capacitor/core is not listed in package.json dependencies."
    assert "@capacitor/filesystem" in deps, "@capacitor/filesystem is not listed in package.json dependencies."
    assert "vite" in deps, "vite is not listed in package.json dependencies."


def test_capacitor_filesystem_installed():
    module_dir = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "filesystem")
    assert os.path.isdir(module_dir), (
        f"@capacitor/filesystem is not installed at {module_dir}; run npm install during environment setup."
    )
