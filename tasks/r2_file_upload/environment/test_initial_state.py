import os
import shutil
import pytest

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"package.json not found at {package_json}."


def test_rwsdk_dependency_declared():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json, "r", encoding="utf-8") as f:
        content = f.read()
    assert "rwsdk" in content, "rwsdk dependency not declared in package.json."


def test_wrangler_config_exists():
    wrangler = os.path.join(PROJECT_DIR, "wrangler.jsonc")
    assert os.path.isfile(wrangler), f"wrangler.jsonc not found at {wrangler}."


def test_worker_entry_exists():
    worker = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker), f"src/worker.tsx not found at {worker}."


def test_node_modules_preinstalled():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"node_modules not found at {node_modules}; npm install should have run during image build."
    )


def test_rwsdk_module_installed():
    rwsdk_module = os.path.join(PROJECT_DIR, "node_modules", "rwsdk")
    assert os.path.isdir(rwsdk_module), (
        f"rwsdk package not installed at {rwsdk_module}."
    )
