import os

import pytest

PROJECT_DIR = "/home/user/project"
SAMPLE_INPUT = os.path.join(PROJECT_DIR, "input.wav")


def test_librosa_importable():
    try:
        import librosa  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"librosa could not be imported: {exc}")


def test_numpy_importable():
    try:
        import numpy  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"numpy could not be imported: {exc}")


def test_scipy_importable():
    try:
        import scipy  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"scipy could not be imported: {exc}")


def test_soundfile_importable():
    try:
        import soundfile  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"soundfile could not be imported: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_sample_input_exists_and_is_mono_wav():
    assert os.path.isfile(SAMPLE_INPUT), f"Sample input file {SAMPLE_INPUT} does not exist."
    import soundfile as sf

    info = sf.info(SAMPLE_INPUT)
    assert info.channels == 1, f"Sample input {SAMPLE_INPUT} must be mono, found {info.channels} channels."
    assert info.frames > 0, f"Sample input {SAMPLE_INPUT} contains no audio frames."
