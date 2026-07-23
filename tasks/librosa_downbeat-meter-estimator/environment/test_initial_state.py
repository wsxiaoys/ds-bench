import importlib
import os

import pytest

PROJECT_DIR = "/home/user/project"


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_librosa_importable():
    try:
        librosa = importlib.import_module("librosa")
    except Exception as exc:  # pragma: no cover - explicit failure message
        pytest.fail(f"Failed to import librosa: {exc}")
    assert hasattr(librosa, "beat"), "librosa.beat submodule is not available."


def test_numpy_importable():
    try:
        importlib.import_module("numpy")
    except Exception as exc:  # pragma: no cover
        pytest.fail(f"Failed to import numpy: {exc}")


def test_scipy_importable():
    try:
        importlib.import_module("scipy")
    except Exception as exc:  # pragma: no cover
        pytest.fail(f"Failed to import scipy: {exc}")


def test_soundfile_importable():
    try:
        importlib.import_module("soundfile")
    except Exception as exc:  # pragma: no cover
        pytest.fail(f"Failed to import soundfile: {exc}")
