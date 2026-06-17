import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json not found at {package_json_path}."

def test_nextjs_dependency():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path, 'r') as f:
        content = f.read()
    assert '"next"' in content, "Next.js dependency not found in package.json."
