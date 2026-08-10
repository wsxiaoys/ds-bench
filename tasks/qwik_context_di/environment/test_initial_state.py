import json
import os
import shutil

PROJECT_DIR = "/home/user/qwik-context-di"


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
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik is not declared in package.json."
    assert "@builder.io/qwik-city" in deps, (
        "@builder.io/qwik-city is not declared in package.json."
    )


def test_dependencies_installed():
    qwik_pkg = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json")
    assert os.path.isfile(qwik_pkg), (
        "Qwik dependencies are not installed (node_modules/@builder.io/qwik missing)."
    )


def test_vite_config_exists():
    candidates = [
        os.path.join(PROJECT_DIR, "vite.config.ts"),
        os.path.join(PROJECT_DIR, "vite.config.mts"),
        os.path.join(PROJECT_DIR, "vite.config.js"),
    ]
    assert any(os.path.isfile(c) for c in candidates), (
        "No vite config file found in the project root."
    )


def test_routes_dir_exists():
    routes_dir = os.path.join(PROJECT_DIR, "src", "routes")
    assert os.path.isdir(routes_dir), (
        f"Qwik City routes directory {routes_dir} does not exist."
    )
