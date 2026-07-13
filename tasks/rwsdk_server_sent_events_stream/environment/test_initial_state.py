import json
import os
import shutil

PROJECT_DIR = "/home/user/app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"{package_json} does not exist."


def test_package_json_declares_rwsdk():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "rwsdk" in deps, "The project's package.json does not declare a dependency on 'rwsdk'."


def test_worker_entry_exists():
    worker_entry = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker_entry), (
        f"Expected the RedwoodSDK worker entry point at {worker_entry}."
    )


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"Expected dependencies to be installed at {node_modules}."
    )
