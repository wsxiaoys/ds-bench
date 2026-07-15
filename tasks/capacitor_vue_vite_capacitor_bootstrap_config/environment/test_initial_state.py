import json
import os
import shutil

import pytest

PROJECT_DIR = "/home/user/vue-capacitor-app"
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    assert os.path.isfile(PACKAGE_JSON), f"package.json not found at {PACKAGE_JSON}."


def _load_package_json():
    with open(PACKAGE_JSON) as f:
        return json.load(f)


def test_project_is_vue_vite():
    pkg = _load_package_json()
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "vue" in deps, "Expected 'vue' to be a dependency of the starting project."
    assert "vite" in deps, "Expected 'vite' to be a dependency of the starting project."


def test_vite_config_present():
    candidates = [
        os.path.join(PROJECT_DIR, "vite.config.ts"),
        os.path.join(PROJECT_DIR, "vite.config.js"),
        os.path.join(PROJECT_DIR, "vite.config.mjs"),
    ]
    assert any(os.path.isfile(c) for c in candidates), (
        "Expected a Vite config file (vite.config.ts/js/mjs) in the starting project."
    )


def test_index_html_present():
    index_html = os.path.join(PROJECT_DIR, "index.html")
    assert os.path.isfile(index_html), (
        f"Expected the Vite entry {index_html} to exist in the starting project."
    )


def test_src_directory_present():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Expected source directory {src_dir} to exist."


def test_capacitor_not_yet_installed():
    pkg = _load_package_json()
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "@capacitor/core" not in deps, (
        "@capacitor/core should NOT be installed in the starting project; installing it is part of the task."
    )
    assert "@capacitor/cli" not in deps, (
        "@capacitor/cli should NOT be installed in the starting project; installing it is part of the task."
    )


def test_capacitor_config_not_yet_present():
    for name in ("capacitor.config.ts", "capacitor.config.js", "capacitor.config.json"):
        path = os.path.join(PROJECT_DIR, name)
        assert not os.path.exists(path), (
            f"{path} should NOT exist in the starting project; creating it is part of the task."
        )
