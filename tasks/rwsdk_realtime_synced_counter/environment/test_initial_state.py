import json
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Pre-scaffolded RedwoodSDK project directory {PROJECT_DIR} does not exist."
    )


def test_package_json_exists_and_includes_rwsdk():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "rwsdk" in deps, (
        "Expected the `rwsdk` package to be listed in package.json dependencies."
    )


def test_node_modules_installed():
    nm = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(nm), (
        f"node_modules not found at {nm}; npm dependencies should be pre-installed."
    )
    rwsdk_pkg = os.path.join(nm, "rwsdk", "package.json")
    assert os.path.isfile(rwsdk_pkg), (
        f"rwsdk package not installed under node_modules at {rwsdk_pkg}."
    )


def test_worker_entry_exists():
    worker_path = os.path.join(PROJECT_DIR, "src", "worker.tsx")
    assert os.path.isfile(worker_path), (
        f"Expected RedwoodSDK worker entry at {worker_path}."
    )


def test_wrangler_config_exists():
    wrangler_path = os.path.join(PROJECT_DIR, "wrangler.jsonc")
    assert os.path.isfile(wrangler_path), (
        f"Expected wrangler.jsonc at {wrangler_path}."
    )


def test_dev_script_defined():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    with open(pkg_path) as f:
        data = json.load(f)
    scripts = data.get("scripts", {}) or {}
    assert "dev" in scripts, (
        "Expected an `npm run dev` script to be defined in package.json."
    )


def test_npx_available():
    result = subprocess.run(
        ["npx", "--version"], capture_output=True, text=True
    )
    assert result.returncode == 0, (
        f"`npx --version` failed: {result.stderr or result.stdout}"
    )
