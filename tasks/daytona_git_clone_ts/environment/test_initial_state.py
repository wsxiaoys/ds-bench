import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_node_version_runs():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, (
        f"`node --version` failed with exit code {result.returncode}: {result.stderr}"
    )
    assert result.stdout.strip().startswith("v"), (
        f"Unexpected node version output: {result.stdout!r}"
    )


def test_npm_version_runs():
    result = subprocess.run(
        ["npm", "--version"], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, (
        f"`npm --version` failed with exit code {result.returncode}: {result.stderr}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist."
    )


def test_daytona_api_key_present():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, "DAYTONA_API_KEY environment variable must be set for the task."
