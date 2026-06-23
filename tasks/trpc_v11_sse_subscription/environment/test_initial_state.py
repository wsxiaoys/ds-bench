import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
