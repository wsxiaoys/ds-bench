import json
import os
import shutil

PROJECT_DIR = "/home/user/blog-cms"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_qwik_dependencies_declared():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    all_deps = {}
    all_deps.update(data.get("dependencies", {}))
    all_deps.update(data.get("devDependencies", {}))
    assert "@builder.io/qwik" in all_deps, "@builder.io/qwik is not a declared dependency."
    assert "@builder.io/qwik-city" in all_deps, "@builder.io/qwik-city is not a declared dependency."


def test_dependencies_installed():
    qwik_pkg = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json")
    qwik_city_pkg = os.path.join(
        PROJECT_DIR, "node_modules", "@builder.io", "qwik-city", "package.json"
    )
    assert os.path.isfile(qwik_pkg), "@builder.io/qwik is not installed in node_modules."
    assert os.path.isfile(
        qwik_city_pkg
    ), "@builder.io/qwik-city is not installed in node_modules."


def test_sqlite3_cli_available():
    assert shutil.which("sqlite3") is not None, "sqlite3 CLI not found in PATH (needed for verification)."
