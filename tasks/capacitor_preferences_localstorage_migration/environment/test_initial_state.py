import json
import os
import shutil

PROJECT_DIR = "/home/user/storage-migration"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."


def test_package_json_declares_capacitor_preferences():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@capacitor/preferences" in deps, \
        "package.json must declare a dependency on @capacitor/preferences."
    assert "@capacitor/core" in deps, \
        "package.json must declare a dependency on @capacitor/core."


def test_capacitor_preferences_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "preferences", "package.json")
    assert os.path.isfile(pkg), \
        "@capacitor/preferences is not installed in node_modules."


def test_capacitor_core_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "core", "package.json")
    assert os.path.isfile(pkg), \
        "@capacitor/core is not installed in node_modules."


def test_vite_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "vite", "package.json")
    assert os.path.isfile(pkg), \
        "vite build tool is not installed in node_modules."


def test_index_html_exists():
    index_html = os.path.join(PROJECT_DIR, "index.html")
    assert os.path.isfile(index_html), f"{index_html} does not exist."


def test_src_dir_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"{src_dir} does not exist."
