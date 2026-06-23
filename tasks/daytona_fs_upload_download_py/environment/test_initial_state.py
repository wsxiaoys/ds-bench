import importlib
import os

PROJECT_DIR = "/home/user/myproject"


def test_daytona_sdk_importable():
    try:
        importlib.import_module("daytona")
    except ImportError as exc:
        raise AssertionError(
            f"Daytona Python SDK is not importable: {exc}. "
            "Ensure `pip install daytona` succeeded in the environment."
        )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_daytona_api_key_env_present():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, (
        "DAYTONA_API_KEY environment variable must be set in the task environment."
    )
