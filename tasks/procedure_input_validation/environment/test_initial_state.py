import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_router_file_exists():
    router_path = os.path.join(PROJECT_DIR, "router.ts")
    assert os.path.isfile(router_path), f"Router file {router_path} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json {package_json_path} does not exist."

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."
