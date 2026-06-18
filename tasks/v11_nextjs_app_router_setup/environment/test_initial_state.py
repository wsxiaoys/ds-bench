import os
import shutil
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    pkg_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_json_path), f"File {pkg_json_path} does not exist."
