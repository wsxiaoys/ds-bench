import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"Expected package.json at {package_json}."


def test_rwsdk_dependency_declared():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "rwsdk" in deps, "Expected 'rwsdk' to be declared in package.json dependencies."


def test_node_modules_preinstalled():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"Expected node_modules at {node_modules} (dependencies should be pre-installed)."
    )


def test_rwsdk_module_installed():
    rwsdk_pkg = os.path.join(PROJECT_DIR, "node_modules", "rwsdk", "package.json")
    assert os.path.isfile(rwsdk_pkg), f"Expected rwsdk package installed at {rwsdk_pkg}."


def test_wrangler_config_exists():
    candidates = [
        os.path.join(PROJECT_DIR, "wrangler.jsonc"),
        os.path.join(PROJECT_DIR, "wrangler.json"),
        os.path.join(PROJECT_DIR, "wrangler.toml"),
    ]
    assert any(os.path.isfile(p) for p in candidates), (
        f"Expected a wrangler config file in {PROJECT_DIR} (wrangler.jsonc / .json / .toml)."
    )
