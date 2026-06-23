import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"
FLOW_FILE = os.path.join(PROJECT_DIR, "flow.py")

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_flow_file_exists():
    assert os.path.isfile(FLOW_FILE), f"Flow file {FLOW_FILE} does not exist."
