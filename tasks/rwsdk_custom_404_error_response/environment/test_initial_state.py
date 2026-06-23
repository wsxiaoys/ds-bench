import os
import shutil
import json

PROJECT_DIR = "/home/user/myapp"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert "rwsdk" in deps, "rwsdk dependency missing from package.json."


def test_worker_entry_exists():
    candidates = [
        os.path.join(PROJECT_DIR, "src", "worker.tsx"),
        os.path.join(PROJECT_DIR, "src", "worker.ts"),
    ]
    assert any(os.path.isfile(c) for c in candidates), \
        f"RedwoodSDK worker entry not found in {candidates}."


def test_node_modules_installed():
    nm = os.path.join(PROJECT_DIR, "node_modules", "rwsdk")
    assert os.path.isdir(nm), f"node_modules/rwsdk missing at {nm}; run `npm install`."


def test_wrangler_config_exists():
    candidates = [
        os.path.join(PROJECT_DIR, "wrangler.jsonc"),
        os.path.join(PROJECT_DIR, "wrangler.json"),
        os.path.join(PROJECT_DIR, "wrangler.toml"),
    ]
    assert any(os.path.isfile(c) for c in candidates), \
        "Wrangler config file missing in the project root."
