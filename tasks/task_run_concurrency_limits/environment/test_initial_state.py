import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_flow_py_exists():
    flow_path = os.path.join(PROJECT_DIR, "flow.py")
    assert os.path.isfile(flow_path), f"File {flow_path} does not exist."

def test_initial_flow_py_content():
    flow_path = os.path.join(PROJECT_DIR, "flow.py")
    with open(flow_path) as f:
        content = f.read()
    assert "@task" in content, "Expected @task decorator in flow.py."
    assert "def process_data" in content, "Expected process_data function in flow.py."
    assert "tags=[\"heavy-processing\"]" not in content and "tags=['heavy-processing']" not in content, \
        "Expected process_data task to not have heavy-processing tag initially."
