import importlib
import os

PROJECT_DIR = "/home/user/project"


def test_altair_importable():
    try:
        importlib.import_module("altair")
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"Failed to import the altair library: {exc}")


def test_pandas_importable():
    try:
        importlib.import_module("pandas")
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(f"Failed to import the pandas library: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Expected project directory {PROJECT_DIR} to exist before the task starts."
