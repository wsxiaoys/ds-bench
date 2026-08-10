import os

import pytest

PROJECT_DIR = "/home/user/project"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
SAMPLE_MIXTURE = os.path.join(DATA_DIR, "sample_mixture.wav")


def test_librosa_importable():
    import librosa  # noqa: F401

    assert librosa is not None, "librosa must be importable in the environment."


def test_numpy_importable():
    import numpy  # noqa: F401

    assert numpy is not None, "numpy must be importable in the environment."


def test_scipy_importable():
    import scipy  # noqa: F401

    assert scipy is not None, "scipy must be importable in the environment."


def test_soundfile_importable():
    import soundfile  # noqa: F401

    assert soundfile is not None, "soundfile must be importable in the environment."


def test_sklearn_importable():
    import sklearn  # noqa: F401

    assert sklearn is not None, "scikit-learn must be importable in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} must exist."


def test_data_dir_exists():
    assert os.path.isdir(DATA_DIR), f"Data directory {DATA_DIR} must exist."


def test_sample_mixture_exists():
    assert os.path.isfile(
        SAMPLE_MIXTURE
    ), f"Sample mixture audio {SAMPLE_MIXTURE} must exist."


def test_sample_mixture_is_readable_audio():
    import soundfile as sf

    info = sf.info(SAMPLE_MIXTURE)
    assert info.frames > 0, "Sample mixture audio must contain audio samples."
    assert info.samplerate > 0, "Sample mixture audio must have a valid sample rate."
