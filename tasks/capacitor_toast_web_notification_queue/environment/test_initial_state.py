import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/toast-queue"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_node_version_at_least_20():
    node_path = shutil.which("node")
    assert node_path is not None, "node binary not found in PATH."
    result = subprocess.run([node_path, "--version"], capture_output=True, text=True)
    assert result.returncode == 0, f"`node --version` failed: {result.stderr}"
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    assert major >= 20, f"Node.js 20+ is required for Capacitor v8, found {version}."


def test_project_directory_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Project directory {PROJECT_DIR} does not exist."
