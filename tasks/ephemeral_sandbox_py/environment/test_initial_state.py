import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_daytona_sdk_importable():
    try:
        importlib.import_module("daytona")
    except ImportError as exc:
        pytest.fail(f"Daytona Python SDK is not importable: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_daytona_api_key_env_var_set():
    assert os.environ.get("DAYTONA_API_KEY"), (
        "DAYTONA_API_KEY environment variable is not set; "
        "it is required to authenticate with the Daytona API."
    )
