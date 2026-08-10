import importlib
import os

import pytest

PROJECT_DIR = "/home/user/project"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


@pytest.mark.parametrize("module_name", ["librosa", "numpy", "scipy", "soundfile"])
def test_required_library_importable(module_name):
    try:
        importlib.import_module(module_name)
    except Exception as exc:  # noqa: BLE001
        pytest.fail(f"Required library '{module_name}' could not be imported: {exc}")


def test_solution_script_absent_initially():
    # The executor is expected to CREATE this script; it must not exist yet.
    script_path = os.path.join(PROJECT_DIR, "shape_transients.py")
    assert not os.path.exists(script_path), (
        f"{script_path} should not exist before the task is solved."
    )
