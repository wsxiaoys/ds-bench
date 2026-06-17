import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, (
        "node binary not found in PATH; Node.js is required to run the TypeScript CLI."
    )


def test_npm_binary_available():
    assert shutil.which("npm") is not None, (
        "npm binary not found in PATH; npm is required to install @alchemystai/sdk and openai."
    )


def test_node_major_version_is_24():
    result = subprocess.run(
        ["node", "--version"],
        capture_output=True,
        text=True,
        check=True,
    )
    version = result.stdout.strip()
    assert version.startswith("v24."), (
        f"Expected Node.js v24.x to be installed, found {version!r}."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_alchemyst_api_key_env_var_set():
    value = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert value, (
        "ALCHEMYST_AI_API_KEY environment variable must be set in the initial environment."
    )


def test_openai_api_key_env_var_set():
    value = os.environ.get("OPENAI_API_KEY")
    assert value, (
        "OPENAI_API_KEY environment variable must be set in the initial environment."
    )


def test_zealt_run_id_env_var_set():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value, (
        "ZEALT_RUN_ID environment variable must be set so the agent can namespace Alchemyst file_name metadata."
    )
