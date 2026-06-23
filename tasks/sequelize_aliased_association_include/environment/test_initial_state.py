import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_dependencies_installed():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), "package.json does not exist."
    
    # Check if sequelize and sqlite3 are installed
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), "node_modules directory does not exist."
    assert os.path.isdir(os.path.join(node_modules, "sequelize")), "sequelize is not installed."
    assert os.path.isdir(os.path.join(node_modules, "sqlite3")), "sqlite3 is not installed."
