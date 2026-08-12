import json
import os
import re
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/inv"
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")
NODE_MODULES = os.path.join(PROJECT_DIR, "node_modules")
INDEX_JS = os.path.join(PROJECT_DIR, "index.js")
INVENTORY_FILE = os.path.join(PROJECT_DIR, "inventory.json")
RUN_ID_FILE = "/logs/artifacts/run-id"


def _read_run_id():
    assert os.path.isfile(RUN_ID_FILE), (
        f"Run id file {RUN_ID_FILE} does not exist; cannot derive bucket names."
    )
    with open(RUN_ID_FILE, "r") as f:
        run_id = f.read().strip()
    assert run_id, f"Run id file {RUN_ID_FILE} is empty."
    return run_id


def _prefix():
    run_id = _read_run_id()
    name = f"harbor-inv-{run_id}-"
    return re.sub(r"[^a-z0-9.-]", "-", name.lower())


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_node_major_version_is_24():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True
    )
    assert result.returncode == 0, f"'node --version' failed: {result.stderr}"
    version = result.stdout.strip()
    assert version.startswith("v24."), (
        f"Expected Node.js v24.x, got '{version}'."
    )


def test_npx_binary_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_tigris_cli_available():
    """The Tigris CLI must be reachable from PATH."""
    assert shutil.which("tigris") is not None, (
        "tigris CLI binary not found in PATH. The container must install "
        "@tigrisdata/cli globally."
    )


def test_tigris_cli_runs():
    """tigris --version should succeed even without credentials."""
    result = subprocess.run(
        ["tigris", "--version"], capture_output=True, text=True, timeout=30
    )
    assert result.returncode == 0, (
        f"'tigris --version' failed: stdout={result.stdout!r} "
        f"stderr={result.stderr!r}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_package_json_exists_and_declares_agent_kit():
    assert os.path.isfile(PACKAGE_JSON), (
        f"package.json not found at {PACKAGE_JSON}."
    )
    with open(PACKAGE_JSON) as f:
        data = json.load(f)
    deps = {}
    deps.update(data.get("dependencies", {}) or {})
    deps.update(data.get("devDependencies", {}) or {})
    assert "@tigrisdata/agent-kit" in deps, (
        "package.json must declare '@tigrisdata/agent-kit' in dependencies "
        "or devDependencies."
    )


def test_node_modules_directory_exists():
    assert os.path.isdir(NODE_MODULES), (
        f"node_modules directory not found at {NODE_MODULES}. "
        "The project must be pre-installed."
    )


def test_agent_kit_installed():
    pkg_dir = os.path.join(NODE_MODULES, "@tigrisdata", "agent-kit")
    assert os.path.isdir(pkg_dir), (
        f"@tigrisdata/agent-kit is not installed in {pkg_dir}."
    )
    pkg_json = os.path.join(pkg_dir, "package.json")
    assert os.path.isfile(pkg_json), (
        f"package.json for @tigrisdata/agent-kit missing at {pkg_json}."
    )


def _tigris_env():
    env = os.environ.copy()
    access = env.get("TIGRIS_STORAGE_ACCESS_KEY_ID", "")
    secret = env.get("TIGRIS_STORAGE_SECRET_ACCESS_KEY", "")
    env["AWS_ACCESS_KEY_ID"] = access
    env["AWS_SECRET_ACCESS_KEY"] = secret
    env["AWS_REGION"] = "auto"
    env["AWS_DEFAULT_REGION"] = "auto"
    return env


def test_index_js_does_not_exist_yet():
    assert not os.path.exists(INDEX_JS), (
        f"{INDEX_JS} must NOT exist at the start of the task; the user is "
        "expected to author it."
    )


def test_inventory_file_does_not_exist_yet():
    assert not os.path.exists(INVENTORY_FILE), (
        f"{INVENTORY_FILE} must NOT exist at the start of the task; the "
        "user's script is expected to write it."
    )
