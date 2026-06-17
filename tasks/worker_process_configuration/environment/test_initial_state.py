import os
import shutil
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_flow_file_exists():
    flow_path = os.path.join(PROJECT_DIR, "flows/data_pipeline.py")
    assert os.path.isfile(flow_path), f"Flow file {flow_path} does not exist."
    with open(flow_path) as f:
        content = f.read()
    assert "@flow" in content, "Expected @flow decorator in data_pipeline.py"
    assert "def my_flow" in content, "Expected my_flow function in data_pipeline.py"
