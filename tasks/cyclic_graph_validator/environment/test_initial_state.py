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


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), (
        f"package.json not found at {package_json}."
    )


def test_package_json_has_arktype_2_2_0():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = data.get("dependencies", {})
    assert "arktype" in deps, "arktype is not listed in package.json dependencies."
    assert deps["arktype"] == "2.2.0", (
        f"Expected arktype version 2.2.0 but got {deps['arktype']!r}."
    )


def test_arktype_module_installed():
    arktype_dir = os.path.join(PROJECT_DIR, "node_modules", "arktype")
    assert os.path.isdir(arktype_dir), (
        f"arktype is not installed at {arktype_dir}."
    )


def test_tsx_installed():
    tsx_dir = os.path.join(PROJECT_DIR, "node_modules", "tsx")
    assert os.path.isdir(tsx_dir), (
        f"tsx (TypeScript runner) is not installed at {tsx_dir}."
    )


def test_tsconfig_uses_node_next():
    tsconfig_path = os.path.join(PROJECT_DIR, "tsconfig.json")
    assert os.path.isfile(tsconfig_path), (
        f"tsconfig.json not found at {tsconfig_path}."
    )
    with open(tsconfig_path) as f:
        content = f.read()
    assert "NodeNext" in content, (
        "tsconfig.json must configure module/moduleResolution as NodeNext."
    )


def test_arktype_import_works():
    """Sanity check: the arktype module is importable from Node in the project."""
    result = subprocess.run(
        [
            "node",
            "-e",
            "require('arktype'); console.log('ok');",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"Failed to require('arktype') from project: stderr={result.stderr}"
    )
    assert "ok" in result.stdout, (
        f"Unexpected stdout when requiring arktype: {result.stdout!r}"
    )


def test_arktype_scope_export_available():
    """Sanity check: `scope(...).export()` is callable from the installed arktype."""
    result = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            (
                "import { scope } from 'arktype';"
                "const m = scope({ x: { v: 'number' } }).export();"
                "if (!m.x) { throw new Error('scope export missing alias'); }"
                "console.log('ok');"
            ),
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"Failed to call scope(...).export(): stderr={result.stderr}"
    )
    assert "ok" in result.stdout, (
        f"Unexpected stdout from scope export sanity check: {result.stdout!r}"
    )
