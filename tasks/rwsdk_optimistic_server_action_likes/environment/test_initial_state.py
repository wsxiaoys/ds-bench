import json
import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"package.json not found at {package_json}."


def test_rwsdk_is_a_dependency():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "rwsdk" in deps, "The project's package.json does not list 'rwsdk' as a dependency."


def test_dev_script_defined():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    scripts = data.get("scripts", {})
    assert "dev" in scripts, "The project's package.json does not define a 'dev' script."


def test_worker_entry_exists():
    worker_entry = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker_entry), f"RedwoodSDK worker entry {worker_entry} does not exist."


def test_dependencies_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), "node_modules not found; project dependencies are not installed."


def test_rwsdk_installed_in_node_modules():
    rwsdk_pkg = os.path.join(PROJECT_DIR, "node_modules", "rwsdk", "package.json")
    assert os.path.isfile(rwsdk_pkg), "rwsdk is not installed in node_modules."
