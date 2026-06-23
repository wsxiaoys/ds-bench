import os

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_daytona_sdk_importable():
    try:
        import daytona  # noqa: F401
    except ImportError as e:
        pytest.fail(f"Daytona Python SDK is not importable: {e}")


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_daytona_api_key_env_set():
    assert os.environ.get("DAYTONA_API_KEY"), (
        "DAYTONA_API_KEY environment variable is not set in the task environment."
    )
