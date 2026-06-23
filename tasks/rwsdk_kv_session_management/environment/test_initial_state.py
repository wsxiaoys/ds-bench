import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), (
        f"package.json not found at {package_json_path}; the rwsdk scaffold is missing."
    )


def test_package_json_uses_rwsdk():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        package = json.load(f)
    deps = {}
    deps.update(package.get("dependencies") or {})
    deps.update(package.get("devDependencies") or {})
    assert "rwsdk" in deps, (
        "rwsdk dependency not found in package.json; expected the RedwoodSDK scaffold."
    )


def test_node_modules_preinstalled():
    node_modules_path = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules_path), (
        f"node_modules directory not found at {node_modules_path}; "
        "dependencies should have been pre-installed during image build."
    )


def test_rwsdk_module_preinstalled():
    rwsdk_path = os.path.join(PROJECT_DIR, "node_modules", "rwsdk")
    assert os.path.isdir(rwsdk_path), (
        f"rwsdk package not found at {rwsdk_path}; "
        "expected rwsdk to be installed under node_modules."
    )


def test_wrangler_config_exists():
    wrangler_path = os.path.join(PROJECT_DIR, "wrangler.jsonc")
    assert os.path.isfile(wrangler_path), (
        f"wrangler.jsonc not found at {wrangler_path}; "
        "the rwsdk scaffold should provide a wrangler configuration file."
    )


def test_src_directory_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), (
        f"src directory not found at {src_dir}; the rwsdk scaffold should include a src/ folder."
    )
