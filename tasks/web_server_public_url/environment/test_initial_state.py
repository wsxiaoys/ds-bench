import os
import shutil
import pytest

WORK_DIR = "/home/user"

def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."

def test_work_directory_exists():
    assert os.path.isdir(WORK_DIR), f"Working directory {WORK_DIR} does not exist."
