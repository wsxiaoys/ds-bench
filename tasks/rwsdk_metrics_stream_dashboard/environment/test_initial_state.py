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


def test_package_json_has_rwsdk():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"{pkg_path} does not exist."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "rwsdk" in deps, "package.json must declare the 'rwsdk' dependency."


def test_rwsdk_installed():
    rwsdk_dir = os.path.join(PROJECT_DIR, "node_modules", "rwsdk")
    assert os.path.isdir(rwsdk_dir), (
        "rwsdk is not installed in node_modules; dependencies must be installed."
    )


def test_starter_files_present():
    expected = [
        "vite.config.mts",
        "wrangler.jsonc",
        "tsconfig.json",
        os.path.join("src", "worker.tsx"),
        os.path.join("src", "client.tsx"),
        os.path.join("src", "app", "document.tsx"),
    ]
    for rel in expected:
        path = os.path.join(PROJECT_DIR, rel)
        assert os.path.isfile(path), f"Expected starter file {path} to exist."
