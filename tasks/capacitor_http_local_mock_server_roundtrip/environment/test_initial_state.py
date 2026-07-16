import os
import shutil

PROJECT_DIR = "/home/user/capacitor-http-app"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"Expected {package_json} to exist in the pre-baked project."


def test_capacitor_core_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "core", "package.json")
    assert os.path.isfile(pkg), "@capacitor/core is not installed in the project's node_modules."


def test_capacitor_cli_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "@capacitor", "cli", "package.json")
    assert os.path.isfile(pkg), "@capacitor/cli is not installed in the project's node_modules."


def test_typescript_installed():
    pkg = os.path.join(PROJECT_DIR, "node_modules", "typescript", "package.json")
    assert os.path.isfile(pkg), "typescript is not installed in the project's node_modules."


def test_tsx_available():
    tsx_bin = os.path.join(PROJECT_DIR, "node_modules", ".bin", "tsx")
    assert os.path.isfile(tsx_bin), "tsx runner is not installed in the project's node_modules/.bin."
