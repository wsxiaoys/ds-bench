import importlib
import os

PROJECT_DIR = "/home/user/myproject"


def test_daytona_sdk_importable():
    try:
        importlib.import_module("daytona")
    except ImportError as exc:
        raise AssertionError(
            "The Daytona Python SDK ('daytona') must be importable in the environment."
        ) from exc


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} must exist before the task starts."
    )


def test_daytona_api_key_env_set():
    assert os.environ.get("DAYTONA_API_KEY"), (
        "DAYTONA_API_KEY environment variable must be set in the task environment."
    )


def test_run_id_set():
    assert open("/logs/artifacts/run-id").read().strip(), (
        "RUN_ID must be set in the task environment."
    )
