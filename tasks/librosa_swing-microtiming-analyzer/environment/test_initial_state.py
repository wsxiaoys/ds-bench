import importlib

import pytest

PROJECT_DIR = "/home/user/project"


def test_project_directory_exists():
    import os

    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task begins."
    )


def test_librosa_importable():
    try:
        importlib.import_module("librosa")
    except Exception as exc:  # pragma: no cover - diagnostic message only
        pytest.fail(f"The 'librosa' library must be importable, but importing it failed: {exc}")


def test_numpy_importable():
    try:
        importlib.import_module("numpy")
    except Exception as exc:  # pragma: no cover - diagnostic message only
        pytest.fail(f"The 'numpy' library must be importable, but importing it failed: {exc}")


def test_scipy_importable():
    try:
        importlib.import_module("scipy")
    except Exception as exc:  # pragma: no cover - diagnostic message only
        pytest.fail(f"The 'scipy' library must be importable, but importing it failed: {exc}")


def test_soundfile_importable():
    try:
        importlib.import_module("soundfile")
    except Exception as exc:  # pragma: no cover - diagnostic message only
        pytest.fail(f"The 'soundfile' library must be importable, but importing it failed: {exc}")
