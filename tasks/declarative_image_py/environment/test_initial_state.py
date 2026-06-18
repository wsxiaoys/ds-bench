import importlib
import os


PROJECT_DIR = "/home/user/myproject"


def test_daytona_sdk_importable():
    try:
        importlib.import_module("daytona")
    except ImportError as exc:
        raise AssertionError(
            f"Daytona Python SDK is not importable: {exc}. "
            "The 'daytona' package must be installed in the environment."
        )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist. "
        "It must be present before the task runs."
    )


def test_daytona_api_key_env_var_set():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, (
        "DAYTONA_API_KEY environment variable is not set. "
        "The task needs a valid Daytona API key to talk to the real Daytona service."
    )
