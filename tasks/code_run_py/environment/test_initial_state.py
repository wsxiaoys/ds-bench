import importlib
import os

PROJECT_DIR = "/home/user/myproject"
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")


def test_daytona_sdk_importable():
    try:
        importlib.import_module("daytona")
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(
            f"Daytona Python SDK is not importable: {exc!r}. Ensure the 'daytona' package is installed."
        )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist; it must be present before the task runs."
    )


def test_output_log_not_present():
    assert not os.path.exists(OUTPUT_LOG), (
        f"Output log {OUTPUT_LOG} should not exist before the task runs; the executor is expected to create it."
    )
