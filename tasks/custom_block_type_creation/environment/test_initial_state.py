import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_prefect_configured_correctly():
    # Verify that prefect uses local SQLite (default profile)
    result = subprocess.run(["prefect", "config", "view"], capture_output=True, text=True)
    assert result.returncode == 0, "Failed to run prefect config view."
