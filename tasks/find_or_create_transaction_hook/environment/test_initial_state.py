import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_sequelize_installed():
    node_modules_path = os.path.join(PROJECT_DIR, "node_modules", "sequelize")
    assert os.path.isdir(node_modules_path), "sequelize package is not installed in node_modules."

def test_sqlite3_installed():
    node_modules_path = os.path.join(PROJECT_DIR, "node_modules", "sqlite3")
    assert os.path.isdir(node_modules_path), "sqlite3 package is not installed in node_modules."