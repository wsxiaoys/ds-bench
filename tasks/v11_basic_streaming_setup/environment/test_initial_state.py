import os
import shutil
import json

PROJECT_DIR = "/home/user/app"

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_trpc_packages_installed():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        data = json.load(f)
    deps = data.get("dependencies", {})
    assert "@trpc/server" in deps, "Expected @trpc/server to be in dependencies."
    assert "@trpc/client" in deps, "Expected @trpc/client to be in dependencies."
    assert "@trpc/react-query" in deps, "Expected @trpc/react-query to be in dependencies."
    assert "@tanstack/react-query" in deps, "Expected @tanstack/react-query to be in dependencies."
