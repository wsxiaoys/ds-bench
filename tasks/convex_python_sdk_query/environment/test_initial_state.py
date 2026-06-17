import os
import shutil

PROJECT_DIR = "/home/user/myproject"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_python_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."

def test_pip_available():
    assert shutil.which("pip") is not None, "pip binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
