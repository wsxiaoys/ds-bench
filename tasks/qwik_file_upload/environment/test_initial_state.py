import json
import os
import shutil

PROJECT_DIR = "/home/user/qwik-upload"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_package_json_has_qwik_dependencies():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik is not a project dependency."
    assert "@builder.io/qwik-city" in deps, "@builder.io/qwik-city is not a project dependency."


def test_package_json_has_better_sqlite3():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "better-sqlite3" in deps, "better-sqlite3 is not available in the project dependencies."


def test_package_json_has_build_and_serve_scripts():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg) as f:
        data = json.load(f)
    scripts = data.get("scripts", {})
    assert "build" in scripts, "The 'build' npm script is missing."
    assert "serve" in scripts, "The 'serve' npm script is missing."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), "node_modules is missing; dependencies are not installed."


def test_better_sqlite3_installed():
    mod = os.path.join(PROJECT_DIR, "node_modules", "better-sqlite3")
    assert os.path.isdir(mod), "better-sqlite3 is not installed in node_modules."


def test_src_routes_dir_exists():
    routes_dir = os.path.join(PROJECT_DIR, "src", "routes")
    assert os.path.isdir(routes_dir), f"Qwik City routes directory {routes_dir} does not exist."


def test_vite_config_exists():
    vite_config = os.path.join(PROJECT_DIR, "vite.config.ts")
    assert os.path.isfile(vite_config), "vite.config.ts is missing from the project."
