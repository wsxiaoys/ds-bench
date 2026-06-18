import os
import pytest
import subprocess

PROJECT_DIR = "/home/user/myproject"

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_node_installed():
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True, check=True)
        assert result.stdout.startswith("v"), "Node.js is not installed or not working properly."
    except Exception as e:
        pytest.fail(f"Failed to run node: {e}")

def test_npm_installed():
    try:
        result = subprocess.run(["npm", "--version"], capture_output=True, text=True, check=True)
        assert result.stdout.strip() != "", "npm is not installed or not working properly."
    except Exception as e:
        pytest.fail(f"Failed to run npm: {e}")

def test_dependencies_installed():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json not found in {PROJECT_DIR}."
    
    node_modules_path = os.path.join(PROJECT_DIR, "node_modules", "sequelize")
    assert os.path.isdir(node_modules_path), "sequelize is not installed in node_modules."
    
    sqlite3_path = os.path.join(PROJECT_DIR, "node_modules", "sqlite3")
    assert os.path.isdir(sqlite3_path), "sqlite3 is not installed in node_modules."
