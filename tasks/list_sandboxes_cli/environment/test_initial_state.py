import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_daytona_binary_available():
    assert shutil.which("daytona") is not None, "daytona binary not found in PATH."


def test_jq_binary_available():
    assert shutil.which("jq") is not None, "jq binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_daytona_api_key_env_present():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, "DAYTONA_API_KEY environment variable must be set."


def test_zealt_run_id_env_present():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable must be set."
