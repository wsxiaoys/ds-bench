import os
import shutil
import subprocess


PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_node_major_version_is_24():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, (
        f"Failed to run `node --version`: stderr={result.stderr}"
    )
    version = result.stdout.strip()
    assert version.startswith("v24."), (
        f"Expected Node.js v24.x at startup, got: {version!r}"
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_alchemyst_api_key_env_set():
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert api_key, (
        "ALCHEMYST_AI_API_KEY environment variable is not set; the task requires it."
    )


def test_zealt_run_id_env_set():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "ZEALT_RUN_ID environment variable is not set; the task requires it."
    )
