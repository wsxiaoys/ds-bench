import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_npm_available():
    assert shutil.which("npm") is not None, "npm is not available in PATH"

def test_npx_available():
    assert shutil.which("npx") is not None, "npx is not available in PATH"

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist"

def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist"

def test_convex_dir_exists():
    convex_dir = os.path.join(PROJECT_DIR, "convex")
    assert os.path.isdir(convex_dir), f"Convex directory {convex_dir} does not exist"

def test_function_files_exist():
    for func_file in ["a.ts", "b.ts", "c.ts"]:
        file_path = os.path.join(PROJECT_DIR, "convex", func_file)
        assert os.path.isfile(file_path), f"Function file {file_path} does not exist"
