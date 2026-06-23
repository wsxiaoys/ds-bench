import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_trpc_utils_exists():
    trpc_utils_path = os.path.join(PROJECT_DIR, "src/utils/trpc.ts")
    assert os.path.isfile(trpc_utils_path), f"File {trpc_utils_path} does not exist."

def test_initial_transformer_location():
    trpc_utils_path = os.path.join(PROJECT_DIR, "src/utils/trpc.ts")
    with open(trpc_utils_path) as f:
        content = f.read()
    assert "transformer: superjson" in content, "Expected initial transformer configuration in src/utils/trpc.ts."
