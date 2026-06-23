import os
import json
import pytest
import shutil

PROJECT_DIR = "/home/user/app"

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_trpc_v10_installed():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        data = json.load(f)
    
    deps = data.get("dependencies", {})
    assert "@trpc/server" in deps, "@trpc/server dependency missing."
    assert "10." in deps["@trpc/server"] or "^10." in deps["@trpc/server"], "Expected @trpc/server v10."

def test_utils_trpc_exists():
    trpc_ts_path = os.path.join(PROJECT_DIR, "src", "utils", "trpc.ts")
    assert os.path.isfile(trpc_ts_path), f"File {trpc_ts_path} does not exist."

def test_server_context_exists():
    context_ts_path = os.path.join(PROJECT_DIR, "src", "server", "context.ts")
    assert os.path.isfile(context_ts_path), f"File {context_ts_path} does not exist."
