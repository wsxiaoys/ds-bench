import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_working_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
