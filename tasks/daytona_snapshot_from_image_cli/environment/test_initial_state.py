import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_daytona_binary_available():
    assert shutil.which("daytona") is not None, "daytona binary not found in PATH."


def test_jq_binary_available():
    assert shutil.which("jq") is not None, "jq binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_daytona_cli_runs():
    result = subprocess.run(
        ["daytona", "--version"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"`daytona --version` failed with exit code {result.returncode}. "
        f"stdout: {result.stdout!r}, stderr: {result.stderr!r}"
    )


def test_daytona_api_key_present():
    assert os.environ.get("DAYTONA_API_KEY"), "DAYTONA_API_KEY environment variable is not set."
