import os
import importlib

import pytest

PROJECT_DIR = "/home/user/vibrato_analyzer"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_librosa_importable():
    mod = importlib.import_module("librosa")
    assert mod is not None, "librosa could not be imported."


def test_librosa_version():
    import librosa

    assert librosa.__version__.startswith("0.11"), (
        f"Expected librosa 0.11.x, found {librosa.__version__}."
    )


def test_numpy_importable():
    mod = importlib.import_module("numpy")
    assert mod is not None, "numpy could not be imported."


def test_scipy_importable():
    mod = importlib.import_module("scipy")
    assert mod is not None, "scipy could not be imported."


def test_soundfile_importable():
    mod = importlib.import_module("soundfile")
    assert mod is not None, "soundfile could not be imported."
