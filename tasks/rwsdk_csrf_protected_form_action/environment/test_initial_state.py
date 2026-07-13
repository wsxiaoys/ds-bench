import os
import shutil

PROJECT_DIR = "/home/user/csrf-app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"Expected scaffolded project file {package_json} to exist."


def test_worker_entry_exists():
    worker_entry = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker_entry), f"Expected RedwoodSDK worker entry {worker_entry} to exist."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"Expected dependencies to be installed at {node_modules}."
    )


def test_rwsdk_dependency_present():
    node_modules_rwsdk = os.path.join(PROJECT_DIR, "node_modules", "rwsdk")
    assert os.path.isdir(node_modules_rwsdk), (
        "Expected the 'rwsdk' package to be installed in the project's node_modules."
    )
