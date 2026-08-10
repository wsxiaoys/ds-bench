import os
import shutil
import json

PROJECT_DIR = "/home/user/rbac-dashboard"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."


def test_package_json_is_qwik_city_project():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}) or {})
    deps.update(pkg.get("devDependencies", {}) or {})
    assert "@builder.io/qwik-city" in deps, (
        "Expected @builder.io/qwik-city to be a declared dependency in package.json."
    )
    assert "@builder.io/qwik" in deps, (
        "Expected @builder.io/qwik to be a declared dependency in package.json."
    )
