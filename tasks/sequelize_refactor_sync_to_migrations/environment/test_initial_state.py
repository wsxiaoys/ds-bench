import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_index_js_exists_and_contains_sync():
    index_js_path = os.path.join(PROJECT_DIR, "index.js")
    assert os.path.isfile(index_js_path), f"File {index_js_path} does not exist."
    
    with open(index_js_path, "r") as f:
        content = f.read()
        
    assert "sync(" in content, "Expected initial index.js to contain a call to sync()."
