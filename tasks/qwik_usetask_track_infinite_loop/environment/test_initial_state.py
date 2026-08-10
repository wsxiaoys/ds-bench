import json
import os
import shutil

PROJECT_DIR = "/home/user/qwik-app"
PKG_JSON = os.path.join(PROJECT_DIR, "package.json")
INDEX_ROUTE = os.path.join(PROJECT_DIR, "src", "routes", "index.tsx")


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_pins_qwik_versions():
    assert os.path.isfile(PKG_JSON), f"package.json not found at {PKG_JSON}."
    with open(PKG_JSON) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik is not a declared dependency."
    assert "@builder.io/qwik-city" in deps, "@builder.io/qwik-city is not a declared dependency."
    assert "1.20.0" in deps["@builder.io/qwik"], (
        f"@builder.io/qwik must be pinned to 1.20.0, found {deps['@builder.io/qwik']}."
    )
    assert "1.20.0" in deps["@builder.io/qwik-city"], (
        f"@builder.io/qwik-city must be pinned to 1.20.0, found {deps['@builder.io/qwik-city']}."
    )


def test_qwik_dependencies_installed():
    qwik_pkg = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json")
    qwik_city_pkg = os.path.join(
        PROJECT_DIR, "node_modules", "@builder.io", "qwik-city", "package.json"
    )
    assert os.path.isfile(qwik_pkg), "@builder.io/qwik is not installed in node_modules."
    assert os.path.isfile(qwik_city_pkg), "@builder.io/qwik-city is not installed in node_modules."


def test_index_route_exists_with_dom_hooks():
    assert os.path.isfile(INDEX_ROUTE), f"Index route component not found at {INDEX_ROUTE}."
    with open(INDEX_ROUTE) as f:
        content = f.read()
    # Static (literal) test hooks.
    for testid in [
        'data-testid="total"',
        'data-testid="coupon"',
        'data-testid="auto-toggle"',
    ]:
        assert testid in content, f"Expected {testid} to already exist in {INDEX_ROUTE}."
    # Per-item hooks are generated from the item id; ensure the prefixes exist.
    for prefix in ["qty-", "inc-", "dec-"]:
        assert prefix in content, (
            f"Expected per-item test hook prefix '{prefix}' to already exist in {INDEX_ROUTE}."
        )


def test_index_route_starts_from_broken_task_wiring():
    # The starting (broken) implementation drives its reactive state through useTask$.
    with open(INDEX_ROUTE) as f:
        content = f.read()
    assert "useTask$" in content, (
        "Expected the initial (broken) implementation to use useTask$ for its reactive wiring."
    )
