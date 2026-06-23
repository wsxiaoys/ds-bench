import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_node_and_npm_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_trpc_router_exists():
    router_path = os.path.join(PROJECT_DIR, "src/server/trpc/router.ts")
    assert os.path.isfile(router_path), f"File {router_path} does not exist."

def test_trpc_client_exists():
    client_path = os.path.join(PROJECT_DIR, "src/trpc/client.ts")
    assert os.path.isfile(client_path), f"File {client_path} does not exist."

def test_app_page_exists():
    page_path = os.path.join(PROJECT_DIR, "src/app/page.tsx")
    assert os.path.isfile(page_path), f"File {page_path} does not exist."
