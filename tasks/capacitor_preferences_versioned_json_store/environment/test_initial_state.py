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


def test_package_json_exists_with_dependencies():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = pkg.get("dependencies", {})
    dev_deps = pkg.get("devDependencies", {})
    assert "@capacitor/core" in deps, "@capacitor/core is missing from dependencies."
    assert "@capacitor/preferences" in deps, "@capacitor/preferences is missing from dependencies."
    assert "vitest" in dev_deps, "vitest is missing from devDependencies."
    assert "jsdom" in dev_deps, "jsdom is missing from devDependencies."


def test_capacitor_core_installed():
    mod_path = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "core")
    assert os.path.isdir(mod_path), "@capacitor/core is not installed in node_modules."


def test_capacitor_preferences_installed():
    mod_path = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "preferences")
    assert os.path.isdir(mod_path), "@capacitor/preferences is not installed in node_modules."


def test_vitest_installed():
    mod_path = os.path.join(PROJECT_DIR, "node_modules", "vitest")
    assert os.path.isdir(mod_path), "vitest is not installed in node_modules."


def test_jsdom_installed():
    mod_path = os.path.join(PROJECT_DIR, "node_modules", "jsdom")
    assert os.path.isdir(mod_path), "jsdom is not installed in node_modules."
