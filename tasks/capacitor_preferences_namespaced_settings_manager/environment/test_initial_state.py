import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/settings-manager"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."


def test_capacitor_dependencies_declared():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}) or {})
    deps.update(pkg.get("devDependencies", {}) or {})
    assert "@capacitor/core" in deps, "@capacitor/core is not declared in package.json."
    assert "@capacitor/preferences" in deps, (
        "@capacitor/preferences is not declared in package.json."
    )


def test_preferences_package_installed():
    pref_pkg = os.path.join(
        PROJECT_DIR, "node_modules", "@capacitor", "preferences", "package.json"
    )
    assert os.path.isfile(pref_pkg), (
        "@capacitor/preferences is not installed under node_modules."
    )


def test_vite_installed():
    vite_dir = os.path.join(PROJECT_DIR, "node_modules", "vite")
    assert os.path.isdir(vite_dir), "vite is not installed under node_modules."
