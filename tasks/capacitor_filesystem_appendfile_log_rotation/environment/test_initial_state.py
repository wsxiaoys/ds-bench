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


def test_package_json_has_capacitor_filesystem_dependency():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@capacitor/filesystem" in deps, \
        "@capacitor/filesystem is not listed as a dependency in package.json."
    assert "@capacitor/core" in deps, \
        "@capacitor/core is not listed as a dependency in package.json."


def test_package_json_has_build_and_preview_scripts():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    scripts = data.get("scripts", {})
    assert "build" in scripts, "package.json is missing a 'build' script."
    assert "preview" in scripts, "package.json is missing a 'preview' script."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), \
        f"node_modules directory not found at {node_modules}; dependencies must be pre-installed."


def test_capacitor_filesystem_installed():
    fs_pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "filesystem", "package.json")
    assert os.path.isfile(fs_pkg), \
        "@capacitor/filesystem is not installed under node_modules."


def test_vite_installed():
    vite_bin = os.path.join(PROJECT_DIR, "node_modules", ".bin", "vite")
    assert os.path.isfile(vite_bin) or os.path.islink(vite_bin), \
        "vite is not installed under node_modules/.bin."


def test_index_html_exists():
    index_html = os.path.join(PROJECT_DIR, "index.html")
    assert os.path.isfile(index_html), f"index.html not found at {index_html}."
