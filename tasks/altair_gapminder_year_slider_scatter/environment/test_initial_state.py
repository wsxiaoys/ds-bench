import importlib
import os

PROJECT_DIR = "/home/user/project"


def test_altair_importable():
    try:
        importlib.import_module("altair")
    except Exception as exc:  # noqa: BLE001
        assert False, f"The 'altair' library must be importable, but import failed: {exc}"


def test_pandas_importable():
    try:
        importlib.import_module("pandas")
    except Exception as exc:  # noqa: BLE001
        assert False, f"The 'pandas' library must be importable, but import failed: {exc}"


def test_project_directory_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Project directory {PROJECT_DIR} must exist before the task starts."
