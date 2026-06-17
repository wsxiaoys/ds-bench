import json
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."


def test_arktype_installed_with_pinned_version():
    pkg_json_path = os.path.join(PROJECT_DIR, "node_modules", "arktype", "package.json")
    assert os.path.isfile(pkg_json_path), (
        f"arktype is not installed in node_modules at {pkg_json_path}."
    )
    with open(pkg_json_path) as f:
        data = json.load(f)
    assert data.get("version") == "2.2.0", (
        f"Expected arktype version '2.2.0', got '{data.get('version')}'."
    )


def test_arktype_importable_from_node():
    result = subprocess.run(
        [
            "node",
            "-e",
            "const a = require('arktype'); if (typeof a.match !== 'function') { process.exit(2); }",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"arktype could not be required from Node in {PROJECT_DIR}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
