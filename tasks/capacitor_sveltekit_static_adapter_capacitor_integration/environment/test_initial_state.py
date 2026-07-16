import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/capsvelte"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"node_modules is not installed at {node_modules}; dependencies must be pre-provisioned."
    )


def test_package_json_exists_and_uses_adapter_auto():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    all_deps = {}
    all_deps.update(pkg.get("dependencies", {}))
    all_deps.update(pkg.get("devDependencies", {}))
    assert "@sveltejs/kit" in all_deps, "Expected @sveltejs/kit to be a dependency of the project."
    assert "@sveltejs/adapter-auto" in all_deps, (
        "Expected the initial project to depend on @sveltejs/adapter-auto."
    )
    assert "@sveltejs/adapter-static" not in all_deps, (
        "@sveltejs/adapter-static must NOT be present in the initial state; the executor adds it."
    )


def test_capacitor_cli_present():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        pkg = json.load(f)
    all_deps = {}
    all_deps.update(pkg.get("dependencies", {}))
    all_deps.update(pkg.get("devDependencies", {}))
    assert "@capacitor/cli" in all_deps, "Expected @capacitor/cli to be a dependency of the project."
    assert "@capacitor/core" in all_deps, "Expected @capacitor/core to be a dependency of the project."


def test_svelte_config_uses_adapter_auto():
    cfg_path = os.path.join(PROJECT_DIR, "svelte.config.js")
    assert os.path.isfile(cfg_path), f"svelte.config.js not found at {cfg_path}."
    with open(cfg_path) as f:
        content = f.read()
    assert "@sveltejs/adapter-auto" in content, (
        "Expected the initial svelte.config.js to import @sveltejs/adapter-auto."
    )
    assert "@sveltejs/adapter-static" not in content, (
        "Initial svelte.config.js must NOT reference @sveltejs/adapter-static."
    )


def test_capacitor_config_exists_and_webdir_not_dist():
    cfg_path = os.path.join(PROJECT_DIR, "capacitor.config.ts")
    assert os.path.isfile(cfg_path), f"capacitor.config.ts not found at {cfg_path}."
    with open(cfg_path) as f:
        content = f.read()
    assert "webDir" in content, "capacitor.config.ts must declare a webDir property."
    assert "webDir: 'dist'" not in content and 'webDir: "dist"' not in content, (
        "Initial capacitor.config.ts webDir must NOT already be 'dist'; the executor aligns it."
    )


def test_home_route_exists_with_expected_text():
    page_path = os.path.join(PROJECT_DIR, "src", "routes", "+page.svelte")
    assert os.path.isfile(page_path), f"Home route {page_path} does not exist."
    with open(page_path) as f:
        content = f.read()
    assert "Capacitor SvelteKit Home" in content, (
        "Home route +page.svelte must contain the text 'Capacitor SvelteKit Home'."
    )


def test_status_route_exists_with_expected_text():
    page_path = os.path.join(PROJECT_DIR, "src", "routes", "status", "+page.svelte")
    assert os.path.isfile(page_path), f"Status route {page_path} does not exist."
    with open(page_path) as f:
        content = f.read()
    assert "Runtime Status: READY" in content, (
        "Status route +page.svelte must contain the text 'Runtime Status: READY'."
    )
