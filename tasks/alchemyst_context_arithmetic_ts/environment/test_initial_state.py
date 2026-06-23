import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_alchemyst_api_key_present():
    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert api_key, "ALCHEMYST_AI_API_KEY is not set in the environment."


def test_zealt_run_id_present():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID is not set in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
