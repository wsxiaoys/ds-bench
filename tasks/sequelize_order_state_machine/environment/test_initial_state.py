import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_sequelize_installed_and_importable():
    result = subprocess.run(
        ["node", "-e", "require('sequelize'); console.log('ok')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"sequelize is not importable from {PROJECT_DIR}. stderr: {result.stderr}"
    )
    assert "ok" in result.stdout, "sequelize import did not produce expected output."


def test_sqlite3_driver_installed_and_importable():
    result = subprocess.run(
        ["node", "-e", "require('sqlite3'); console.log('ok')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"sqlite3 driver is not importable from {PROJECT_DIR}. stderr: {result.stderr}"
    )
    assert "ok" in result.stdout, "sqlite3 import did not produce expected output."
