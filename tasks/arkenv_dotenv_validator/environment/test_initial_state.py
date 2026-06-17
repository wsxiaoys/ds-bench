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


def test_package_json_pins_arktype_2_2_0():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = data.get("dependencies", {})
    assert "arktype" in deps, "arktype is not listed in package.json dependencies."
    assert deps["arktype"] == "2.2.0", (
        f"Expected arktype version 2.2.0 but got {deps['arktype']!r}."
    )


def test_package_json_pins_arkenv_0_12_1():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json) as f:
        data = json.load(f)
    deps = data.get("dependencies", {})
    assert "arkenv" in deps, "arkenv is not listed in package.json dependencies."
    assert deps["arkenv"] == "0.12.1", (
        f"Expected arkenv version 0.12.1 but got {deps['arkenv']!r}."
    )


def test_arktype_module_installed():
    arktype_dir = os.path.join(PROJECT_DIR, "node_modules", "arktype")
    assert os.path.isdir(arktype_dir), (
        f"arktype is not installed at {arktype_dir}."
    )


def test_arkenv_module_installed():
    arkenv_dir = os.path.join(PROJECT_DIR, "node_modules", "arkenv")
    assert os.path.isdir(arkenv_dir), (
        f"arkenv is not installed at {arkenv_dir}."
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


def test_cli_entrypoint_placeholder_exists():
    cli_path = os.path.join(PROJECT_DIR, "cli.ts")
    assert os.path.isfile(cli_path), (
        f"Expected CLI entrypoint placeholder at {cli_path}."
    )


def test_arkenv_import_works():
    """Sanity check: the arkenv module is importable from Node in the project."""
    script = (
        "import('arkenv').then(m => { "
        "if (typeof m.default !== 'function' && typeof m.arkenv !== 'function' && typeof m.createEnv !== 'function') { "
        "throw new Error('arkenv default/named export not callable'); } "
        "console.log('ok'); });"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"Failed to import('arkenv') from project: stderr={result.stderr}"
    )
    assert "ok" in result.stdout, (
        f"Unexpected stdout when importing arkenv: {result.stdout!r}"
    )
