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
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    assert "arktype" in deps, (
        "arktype is not listed in package.json (dev)dependencies."
    )
    assert deps["arktype"] == "2.2.0", (
        f"Expected arktype version 2.2.0 but got {deps['arktype']!r}."
    )


def test_package_json_has_attest_0_56_0():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    assert "@arktype/attest" in deps, (
        "@arktype/attest is not listed in package.json (dev)dependencies."
    )
    assert deps["@arktype/attest"] == "0.56.0", (
        f"Expected @arktype/attest version 0.56.0 but got "
        f"{deps['@arktype/attest']!r}."
    )


def test_package_json_has_vitest():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    assert "vitest" in deps, (
        "vitest is not listed in package.json (dev)dependencies."
    )


def test_package_json_test_script_runs_vitest():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    scripts = data.get("scripts", {})
    assert "test" in scripts, "package.json must define a `test` script."
    assert "vitest" in scripts["test"], (
        f"Expected the `test` script to invoke vitest, got {scripts['test']!r}."
    )


def test_arktype_module_installed():
    arktype_dir = os.path.join(PROJECT_DIR, "node_modules", "arktype")
    assert os.path.isdir(arktype_dir), (
        f"arktype is not installed at {arktype_dir}."
    )


def test_attest_module_installed():
    attest_dir = os.path.join(
        PROJECT_DIR, "node_modules", "@arktype", "attest"
    )
    assert os.path.isdir(attest_dir), (
        f"@arktype/attest is not installed at {attest_dir}."
    )


def test_vitest_module_installed():
    vitest_dir = os.path.join(PROJECT_DIR, "node_modules", "vitest")
    assert os.path.isdir(vitest_dir), (
        f"vitest is not installed at {vitest_dir}."
    )


def test_typescript_module_installed():
    ts_dir = os.path.join(PROJECT_DIR, "node_modules", "typescript")
    assert os.path.isdir(ts_dir), (
        f"typescript is not installed at {ts_dir}."
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
    """Sanity check: arktype is importable from Node in the project."""
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


def test_attest_import_works():
    """Sanity check: @arktype/attest is importable from Node in the project."""
    result = subprocess.run(
        [
            "node",
            "-e",
            "const a = require('@arktype/attest'); "
            "if (typeof a.setup !== 'function') { "
            "  throw new Error('attest.setup is not a function'); "
            "} console.log('ok');",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"Failed to require('@arktype/attest') from project: "
        f"stderr={result.stderr}"
    )
    assert "ok" in result.stdout, (
        f"Unexpected stdout when requiring @arktype/attest: {result.stdout!r}"
    )
