import json
import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"{package_json_path} does not exist."


def test_arktype_dependency_pinned():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        package_data = json.load(f)
    deps = package_data.get("dependencies", {})
    assert deps.get("arktype") == "2.2.0", (
        f"Expected arktype dependency pinned to 2.2.0 in package.json, got {deps.get('arktype')!r}."
    )


def test_typescript_dev_dependency_present():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        package_data = json.load(f)
    dev_deps = package_data.get("devDependencies", {})
    assert "typescript" in dev_deps, "Expected 'typescript' to be in devDependencies of package.json."


def test_arktype_installed_in_node_modules():
    arktype_dir = os.path.join(PROJECT_DIR, "node_modules", "arktype")
    assert os.path.isdir(arktype_dir), (
        f"Expected arktype to be installed at {arktype_dir} (run npm install in the project directory)."
    )


def test_typescript_compiler_available_via_npx():
    result = subprocess.run(
        ["npx", "--no-install", "tsc", "--version"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Expected `npx tsc --version` to succeed in {PROJECT_DIR}. stdout={result.stdout!r}, stderr={result.stderr!r}."
    )


def test_tsconfig_exists():
    tsconfig_path = os.path.join(PROJECT_DIR, "tsconfig.json")
    assert os.path.isfile(tsconfig_path), f"{tsconfig_path} does not exist."


def test_types_ts_exists_with_product_interface():
    types_path = os.path.join(PROJECT_DIR, "types.ts")
    assert os.path.isfile(types_path), f"{types_path} does not exist."
    with open(types_path) as f:
        content = f.read()
    assert "interface Product" in content, (
        "Expected pre-existing `interface Product` declaration in types.ts."
    )
    for prop in ("id", "sku", "price", "tags"):
        assert prop in content, f"Expected property `{prop}` to be declared on the Product interface."


def test_schema_ts_does_not_yet_exist():
    schema_path = os.path.join(PROJECT_DIR, "schema.ts")
    assert not os.path.exists(schema_path), (
        f"{schema_path} should not yet exist; the executor is expected to create it."
    )


def test_broken_ts_does_not_yet_exist():
    broken_path = os.path.join(PROJECT_DIR, "broken.ts")
    assert not os.path.exists(broken_path), (
        f"{broken_path} should not yet exist; the executor is expected to create it."
    )
