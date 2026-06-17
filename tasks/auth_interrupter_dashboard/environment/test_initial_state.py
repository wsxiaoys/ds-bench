import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"package.json not found at {package_json}."


def test_package_json_has_rwsdk_dependency():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "rwsdk" in deps, (
        "Expected 'rwsdk' to be listed in package.json dependencies (the RedwoodSDK package)."
    )


def test_package_json_has_dev_script():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    scripts = data.get("scripts", {}) or {}
    assert "dev" in scripts, "Expected a 'dev' script in package.json (used to start the dev server)."


def test_node_modules_preinstalled():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        "node_modules directory not found; npm dependencies should be pre-installed in the image."
    )


def test_rwsdk_package_installed():
    rwsdk_dir = os.path.join(PROJECT_DIR, "node_modules", "rwsdk")
    assert os.path.isdir(rwsdk_dir), (
        "The 'rwsdk' package was not pre-installed under node_modules/rwsdk."
    )


def test_session_secret_env_var_set():
    secret = os.environ.get("SESSION_SECRET")
    assert secret is not None and len(secret) > 0, (
        "SESSION_SECRET environment variable must be set in the task environment "
        "so the app can sign session cookies."
    )
