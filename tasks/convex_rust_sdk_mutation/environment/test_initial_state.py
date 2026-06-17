import os
import shutil
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_rust_available():
    assert shutil.which("cargo") is not None, "cargo binary not found in PATH."
    assert shutil.which("rustc") is not None, "rustc binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
