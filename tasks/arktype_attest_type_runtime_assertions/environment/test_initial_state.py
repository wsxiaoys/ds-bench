import json
import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"{package_json_path} does not exist."


def test_package_json_has_arktype_dependency():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies") or {})
    deps.update(pkg.get("devDependencies") or {})
    assert "arktype" in deps, "package.json must declare an 'arktype' dependency."
    assert deps["arktype"].endswith("2.2.0") or "2.2.0" in deps["arktype"], (
        f"Expected arktype@2.2.0 in package.json, got {deps['arktype']!r}."
    )


def test_package_json_has_arktype_attest_dependency():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies") or {})
    deps.update(pkg.get("devDependencies") or {})
    assert "@arktype/attest" in deps, "package.json must declare a '@arktype/attest' dependency."
    assert deps["@arktype/attest"].endswith("0.56.0") or "0.56.0" in deps["@arktype/attest"], (
        f"Expected @arktype/attest@0.56.0 in package.json, got {deps['@arktype/attest']!r}."
    )


def test_package_json_has_vitest_dependency():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies") or {})
    deps.update(pkg.get("devDependencies") or {})
    assert "vitest" in deps, "package.json must declare a 'vitest' dependency."


def test_tsconfig_exists():
    tsconfig_path = os.path.join(PROJECT_DIR, "tsconfig.json")
    assert os.path.isfile(tsconfig_path), f"{tsconfig_path} does not exist."


def test_node_modules_installed():
    arktype_dir = os.path.join(PROJECT_DIR, "node_modules", "arktype")
    attest_dir = os.path.join(PROJECT_DIR, "node_modules", "@arktype", "attest")
    vitest_dir = os.path.join(PROJECT_DIR, "node_modules", "vitest")
    assert os.path.isdir(arktype_dir), f"{arktype_dir} is missing; run npm install during setup."
    assert os.path.isdir(attest_dir), f"{attest_dir} is missing; run npm install during setup."
    assert os.path.isdir(vitest_dir), f"{vitest_dir} is missing; run npm install during setup."


def test_vitest_runner_available():
    result = subprocess.run(
        ["npx", "--no", "vitest", "--version"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"`npx vitest --version` failed in {PROJECT_DIR}: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )
