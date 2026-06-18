import importlib
import os

PROJECT_DIR = "/home/user/myproject"


def test_daytona_module_importable():
    try:
        importlib.import_module("daytona")
    except ImportError as e:
        raise AssertionError(
            f"The 'daytona' Python SDK module must be importable in the environment, but import failed: {e}"
        )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist; the task expects it to be present."
    )


def test_daytona_api_key_env_var_present():
    value = os.environ.get("DAYTONA_API_KEY")
    assert value is not None and value.strip() != "", (
        "The DAYTONA_API_KEY environment variable must be set so the Daytona SDK can authenticate."
    )


def test_zealt_run_id_env_var_present():
    value = os.environ.get("ZEALT_RUN_ID")
    assert value is not None and value.strip() != "", (
        "The ZEALT_RUN_ID environment variable must be set for parallel-run-safe resource naming."
    )
