import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    pkg_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_json_path), f"package.json not found in {PROJECT_DIR}."

def test_node_modules_exists():
    node_modules_path = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules_path), f"node_modules not found in {PROJECT_DIR}."
