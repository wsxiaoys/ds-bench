import json
import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists_and_uses_rwsdk():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "rwsdk" in deps, "Expected 'rwsdk' to be listed as a dependency in package.json."


def test_dependencies_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"{node_modules} does not exist; project dependencies are expected to be installed."
    )
    rwsdk_installed = os.path.join(node_modules, "rwsdk")
    assert os.path.isdir(rwsdk_installed), "'rwsdk' package is expected to be installed in node_modules."


def test_wrangler_config_exists():
    wrangler = os.path.join(PROJECT_DIR, "wrangler.jsonc")
    assert os.path.isfile(wrangler), f"{wrangler} does not exist."


def test_worker_entry_exists():
    worker = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker), f"Worker entry {worker} does not exist."
