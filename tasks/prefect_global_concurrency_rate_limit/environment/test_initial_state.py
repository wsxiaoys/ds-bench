import importlib.util
import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "The 'prefect' CLI was not found in PATH."


def test_prefect_importable():
    assert (
        importlib.util.find_spec("prefect") is not None
    ), "The 'prefect' Python package is not importable."


def test_project_directory_exists():
    assert os.path.isdir(
        PROJECT_DIR
    ), f"Project directory {PROJECT_DIR} does not exist."
