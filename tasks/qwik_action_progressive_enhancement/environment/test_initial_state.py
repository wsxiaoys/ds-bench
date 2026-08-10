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


def test_package_json_has_qwik_dependencies():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik is not a project dependency."
    assert "@builder.io/qwik-city" in deps, "@builder.io/qwik-city is not a project dependency."


def test_package_json_has_serve_script():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        pkg = json.load(f)
    scripts = pkg.get("scripts", {})
    assert "serve" in scripts, "package.json is missing the 'serve' script."
    assert "build" in scripts, "package.json is missing the 'build' script."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), "Dependencies are not installed (node_modules missing)."
    qwik_city = os.path.join(node_modules, "@builder.io", "qwik-city")
    assert os.path.isdir(qwik_city), "@builder.io/qwik-city is not installed in node_modules."


def test_seed_route_exists():
    route = os.path.join(PROJECT_DIR, "src", "routes", "index.tsx")
    assert os.path.isfile(route), f"Seed route file {route} does not exist."


def test_seed_form_component_exists():
    comp = os.path.join(PROJECT_DIR, "src", "components", "ticket-form", "ticket-form.tsx")
    assert os.path.isfile(comp), f"Seed form component {comp} does not exist."


def test_seed_store_exists():
    store = os.path.join(PROJECT_DIR, "src", "lib", "tickets.ts")
    assert os.path.isfile(store), f"Seed ticket store {store} does not exist."
