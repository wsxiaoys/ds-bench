import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/qwik-app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_node_version_is_18_or_newer():
    node = shutil.which("node")
    assert node is not None, "node binary not found in PATH."
    result = subprocess.run([node, "--version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`node --version` failed: {result.stderr}"
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    assert major >= 18, f"Node.js 18+ is required for Qwik, found {version}."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_sqlite3_cli_available():
    assert shutil.which("sqlite3") is not None, "sqlite3 CLI not found in PATH."
