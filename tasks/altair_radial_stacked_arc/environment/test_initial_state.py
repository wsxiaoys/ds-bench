import importlib.util
import os

PROJECT_DIR = "/home/user/project"


def test_altair_importable():
    assert importlib.util.find_spec("altair") is not None, \
        "The 'altair' library is not importable in the environment."


def test_pandas_importable():
    assert importlib.util.find_spec("pandas") is not None, \
        "The 'pandas' library is not importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), \
        f"Project directory {PROJECT_DIR} does not exist."


def test_output_html_not_present_yet():
    output_path = os.path.join(PROJECT_DIR, "radial.html")
    assert not os.path.exists(output_path), (
        f"{output_path} already exists before the task starts; "
        "it must be created by the executor."
    )
