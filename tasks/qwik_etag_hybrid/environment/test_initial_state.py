import json
import os
import shutil

PROJECT_DIR = "/home/user/qwik-etag-hybrid"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_pins_qwik_versions():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik dependency is missing from package.json."
    assert "@builder.io/qwik-city" in deps, "@builder.io/qwik-city dependency is missing from package.json."
    assert "1.20.0" in deps["@builder.io/qwik"], "Expected @builder.io/qwik to be pinned to 1.20.0."
    assert "1.20.0" in deps["@builder.io/qwik-city"], "Expected @builder.io/qwik-city to be pinned to 1.20.0."


def test_preview_script_present():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        pkg = json.load(f)
    scripts = pkg.get("scripts", {})
    assert "preview" in scripts, "Expected a 'preview' script in package.json."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik")
    assert os.path.isdir(node_modules), "Dependencies are not installed (node_modules/@builder.io/qwik missing)."


def test_vite_config_exists():
    candidates = [
        os.path.join(PROJECT_DIR, "vite.config.ts"),
        os.path.join(PROJECT_DIR, "vite.config.mts"),
        os.path.join(PROJECT_DIR, "vite.config.js"),
    ]
    assert any(os.path.isfile(c) for c in candidates), "No vite config file found in the project."


def test_routes_dir_exists():
    routes_dir = os.path.join(PROJECT_DIR, "src", "routes")
    assert os.path.isdir(routes_dir), f"Qwik City routes directory {routes_dir} does not exist."
