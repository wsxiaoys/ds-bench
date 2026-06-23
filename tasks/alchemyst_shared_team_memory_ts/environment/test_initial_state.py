import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist as the working directory for the task."
    )


def test_alchemyst_api_key_env_present():
    assert os.environ.get("ALCHEMYST_AI_API_KEY"), (
        "ALCHEMYST_AI_API_KEY environment variable must be set so the CLI can authenticate against Alchemyst AI."
    )


def test_zealt_run_id_env_present():
    assert os.environ.get("ZEALT_RUN_ID"), (
        "ZEALT_RUN_ID environment variable must be set so the CLI can namespace the shared sessionId per evaluation run."
    )
