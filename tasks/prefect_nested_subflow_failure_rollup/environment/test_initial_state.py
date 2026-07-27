import importlib.util
import os
import shutil


PROJECT_DIR = "/home/user/nested_pipeline"


def test_prefect_importable():
    spec = importlib.util.find_spec("prefect")
    assert spec is not None, "The 'prefect' package is not importable in the environment."


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "The 'prefect' CLI binary was not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."
