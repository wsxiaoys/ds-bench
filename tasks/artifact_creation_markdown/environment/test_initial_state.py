import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_flow_script_exists():
    script_path = os.path.join(PROJECT_DIR, "flow.py")
    assert os.path.isfile(script_path), f"Flow script {script_path} does not exist."
