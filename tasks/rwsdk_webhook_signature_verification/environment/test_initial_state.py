import json
import os
import re
import shutil

PROJECT_DIR = "/home/user/webhook-app"
ENV_FILE = os.path.join(PROJECT_DIR, ".env")


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"package.json not found at {package_json}."


def test_rwsdk_dependency_present():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}))
    deps.update(data.get("devDependencies", {}))
    assert "rwsdk" in deps, "Expected the 'rwsdk' package to be a dependency of the project."


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"node_modules not found at {node_modules}; project dependencies should be installed."
    )


def test_worker_entry_exists():
    worker_entry = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker_entry), (
        f"RedwoodSDK worker entry {worker_entry} does not exist."
    )


def test_webhook_secret_provisioned():
    assert os.path.isfile(ENV_FILE), (
        f"Expected the project .env file at {ENV_FILE} to provision the shared secret."
    )
    with open(ENV_FILE) as f:
        content = f.read()
    match = re.search(r"^\s*WEBHOOK_SECRET\s*=\s*(.+)\s*$", content, re.MULTILINE)
    assert match and match.group(1).strip(), (
        "WEBHOOK_SECRET is not provisioned in the project .env file."
    )
