import os

import pytest

PROJECT_DIR = "/home/user/vqt"
INPUT_WAV = "/home/user/vqt/input/signal.wav"

EXPECTED_SR = 22050
EXPECTED_SAMPLES = 102400


def test_librosa_importable():
    try:
        import librosa  # noqa: F401
    except Exception as exc:  # pragma: no cover - defensive
        pytest.fail(f"librosa could not be imported: {exc}")


def test_supporting_libraries_importable():
    for mod in ("numpy", "scipy", "soundfile"):
        try:
            __import__(mod)
        except Exception as exc:  # pragma: no cover - defensive
            pytest.fail(f"Required library '{mod}' could not be imported: {exc}")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_input_wav_exists():
    assert os.path.isfile(INPUT_WAV), f"Input audio file {INPUT_WAV} does not exist."


def test_input_wav_properties():
    import soundfile as sf

    info = sf.info(INPUT_WAV)
    assert info.samplerate == EXPECTED_SR, (
        f"Input {INPUT_WAV} sample rate is {info.samplerate}, expected {EXPECTED_SR}."
    )
    assert info.channels == 1, (
        f"Input {INPUT_WAV} has {info.channels} channels, expected mono (1)."
    )
    assert info.frames == EXPECTED_SAMPLES, (
        f"Input {INPUT_WAV} has {info.frames} samples, expected {EXPECTED_SAMPLES}."
    )
