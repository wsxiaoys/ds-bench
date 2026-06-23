import os
import pytest

PROJECT_DIR = "/home/user/app"

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_app_directory_exists():
    app_dir = os.path.join(PROJECT_DIR, "app")
    assert os.path.isdir(app_dir), f"Next.js app directory {app_dir} does not exist."
