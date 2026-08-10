import json
import os
import shutil

PROJECT_DIR = "/home/user/qwik-app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_src_dir_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Source directory {src_dir} does not exist."


def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."


def test_package_json_pins_qwik_1_20_0():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik is not a declared dependency."
    assert "@builder.io/qwik-city" in deps, "@builder.io/qwik-city is not a declared dependency."
    assert "1.20.0" in deps["@builder.io/qwik"], (
        f"Expected @builder.io/qwik pinned to 1.20.0, found {deps['@builder.io/qwik']}."
    )
    assert "1.20.0" in deps["@builder.io/qwik-city"], (
        f"Expected @builder.io/qwik-city pinned to 1.20.0, found {deps['@builder.io/qwik-city']}."
    )


def test_dependencies_installed():
    qwik_pkg = os.path.join(PROJECT_DIR, "node_modules", "@builder.io", "qwik", "package.json")
    assert os.path.isfile(qwik_pkg), (
        "Dependencies are not installed: @builder.io/qwik is missing from node_modules."
    )
