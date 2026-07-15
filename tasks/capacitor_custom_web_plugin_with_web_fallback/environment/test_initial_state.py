import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_capacitor_core_dependency_present():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@capacitor/core" in deps, "@capacitor/core is not listed as a dependency in package.json."


def test_vite_dependency_present():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "vite" in deps, "vite is not listed as a dependency in package.json."


def test_capacitor_core_installed_in_node_modules():
    core_dir = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "core")
    assert os.path.isdir(core_dir), "@capacitor/core is not installed in node_modules."


def test_index_html_exists():
    index_html = os.path.join(PROJECT_DIR, "index.html")
    assert os.path.isfile(index_html), f"index.html not found at {index_html}."
