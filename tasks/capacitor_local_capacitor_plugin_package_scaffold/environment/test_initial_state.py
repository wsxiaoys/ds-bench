import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/capacitor-stringkit"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_node_version_supported():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, check=True
    )
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    assert major >= 20, f"Node.js major version must be >= 20, found {version}."


def test_project_directory_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Project directory {PROJECT_DIR} does not exist."


def test_project_not_already_scaffolded():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert not os.path.isfile(
        package_json
    ), f"{package_json} should not exist before the task begins."


def test_dist_not_prebuilt():
    dist_dir = os.path.join(PROJECT_DIR, "dist")
    assert not os.path.isdir(
        dist_dir
    ), f"{dist_dir} should not exist before the task begins."
