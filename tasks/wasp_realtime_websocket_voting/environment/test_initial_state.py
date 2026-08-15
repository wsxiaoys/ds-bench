import json
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/app"


def test_wasp_cli_available():
    assert shutil.which("wasp") is not None, "wasp CLI binary not found in PATH."


def test_wasp_cli_version_is_pinned():
    result = subprocess.run(
        ["wasp", "version"],
        capture_output=True,
        text=True,
        timeout=120,
    )
    output = f"{result.stdout}\n{result.stderr}"
    assert "0.25.0" in output, f"Expected Wasp CLI 0.25.0, got: {output.strip()}"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_wasp_spec_file_exists():
    spec_path = os.path.join(PROJECT_DIR, "main.wasp.ts")
    assert os.path.isfile(spec_path), f"Wasp spec file {spec_path} does not exist."


def test_prisma_schema_uses_sqlite():
    schema_path = os.path.join(PROJECT_DIR, "schema.prisma")
    assert os.path.isfile(schema_path), f"Prisma schema {schema_path} does not exist."
    with open(schema_path) as f:
        content = f.read()
    assert 'provider = "sqlite"' in content, (
        "Expected the initial Prisma datasource provider to be sqlite in schema.prisma."
    )


def test_package_json_declares_wasp_spec_dependency():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), (
        f"package.json {package_json_path} does not exist."
    )
    with open(package_json_path) as f:
        package_json = json.load(f)
    dev_dependencies = package_json.get("devDependencies", {})
    assert "@wasp.sh/spec" in dev_dependencies, (
        "Expected @wasp.sh/spec to be declared in the project's devDependencies."
    )


def test_project_dependencies_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), (
        f"Project dependencies are not installed: {node_modules} is missing."
    )


def test_src_directory_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Source directory {src_dir} does not exist."


def test_python_socketio_client_available():
    import socketio  # noqa: F401


def test_requests_available():
    import requests  # noqa: F401
