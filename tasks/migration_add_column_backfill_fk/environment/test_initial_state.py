import os
import shutil
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_sequelize_cli_available():
    # Check if sequelize-cli is available via npx or locally in node_modules
    result = subprocess.run(["npx", "sequelize-cli", "--version"], cwd=PROJECT_DIR, capture_output=True, text=True)
    assert result.returncode == 0, f"sequelize-cli is not available: {result.stderr}"

def test_database_and_tables_exist():
    # We can use sqlite3 to check if the database exists and has the tables
    db_path = os.path.join(PROJECT_DIR, "database.sqlite")
    assert os.path.isfile(db_path), f"Database file {db_path} does not exist."

    # Check Departments table
    result = subprocess.run(["sqlite3", db_path, "PRAGMA table_info(Departments);"], capture_output=True, text=True)
    assert result.returncode == 0
    assert "id" in result.stdout and "name" in result.stdout, "Departments table missing expected columns."

    # Check Users table
    result = subprocess.run(["sqlite3", db_path, "PRAGMA table_info(Users);"], capture_output=True, text=True)
    assert result.returncode == 0
    assert "id" in result.stdout and "name" in result.stdout, "Users table missing expected columns."
    assert "departmentId" not in result.stdout, "Users table already has departmentId column."
