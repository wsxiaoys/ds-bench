import os
import shutil
import subprocess
import pytest

WORK_DIR = "/home/user"

def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."

def test_work_directory_exists():
    assert os.path.isdir(WORK_DIR), f"Working directory {WORK_DIR} does not exist."

def test_e2b_sdk_installed():
    result = subprocess.run(
        ["python3", "-c", "import e2b"],
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, "e2b Python SDK is not installed in the environment."
