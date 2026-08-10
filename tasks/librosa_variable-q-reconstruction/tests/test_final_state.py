import json
import os

import numpy as np
import pytest

PROJECT_DIR = "/home/user/vqt"
INPUT_WAV = os.path.join(PROJECT_DIR, "input", "signal.wav")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
VQT_NPY = os.path.join(OUTPUT_DIR, "vqt_magnitude.npy")
RECON_WAV = os.path.join(OUTPUT_DIR, "reconstructed.wav")
REPORT_JSON = os.path.join(OUTPUT_DIR, "report.json")

# Analysis parameters (must match task_description exactly).
SR = 22050
BINS_PER_OCTAVE = 36
N_BINS = 252
GAMMA = 3.0
HOP_LENGTH = 512
EXPECTED_SAMPLES = 102400
EXPECTED_FRAMES = 1 + EXPECTED_SAMPLES // HOP_LENGTH  # 201
EXPECTED_SHAPE = (N_BINS, EXPECTED_FRAMES)

SNR_THRESHOLD_DB = 12.0
MAG_REL_TOL = 0.05  # relative Frobenius-norm tolerance for the magnitude array
SNR_REPORT_TOL_DB = 1.0  # allowed gap between reported and recomputed SNR


def _snr_db(x: np.ndarray, x_hat: np.ndarray) -> float:
    x = np.asarray(x, dtype=np.float64)
    x_hat = np.asarray(x_hat, dtype=np.float64)
    n = min(len(x), len(x_hat))
    x = x[:n]
    x_hat = x_hat[:n]
    noise = x - x_hat
    denom = float(np.sum(noise ** 2))
    return 10.0 * np.log10(float(np.sum(x ** 2)) / (denom + 1e-12))


def _load_original():
    import librosa

    y, _ = librosa.load(INPUT_WAV, sr=SR, mono=True)
    return np.asarray(y, dtype=np.float64)


def _reference_magnitude():
    import librosa

    y, _ = librosa.load(INPUT_WAV, sr=SR, mono=True)
    fmin = librosa.note_to_hz("C1")
    v = librosa.vqt(
        y=y,
        sr=SR,
        hop_length=HOP_LENGTH,
        fmin=fmin,
        n_bins=N_BINS,
        bins_per_octave=BINS_PER_OCTAVE,
        gamma=GAMMA,
    )
    return np.abs(v).astype(np.float64)


def _load_reconstruction():
    import soundfile as sf

    data, sr = sf.read(RECON_WAV, dtype="float64", always_2d=False)
    return np.asarray(data, dtype=np.float64), sr


def test_output_files_exist():
    for path in (VQT_NPY, RECON_WAV, REPORT_JSON):
        assert os.path.isfile(path), f"Expected output artifact is missing: {path}"


def test_vqt_magnitude_array():
    arr = np.load(VQT_NPY)
    assert not np.iscomplexobj(arr), (
        "vqt_magnitude.npy must contain a real-valued magnitude array, "
        "but a complex array was found."
    )
    assert arr.shape == EXPECTED_SHAPE, (
        f"vqt_magnitude.npy has shape {arr.shape}, expected {EXPECTED_SHAPE} "
        f"(n_bins, n_frames)."
    )
    arr64 = arr.astype(np.float64)
    assert np.all(np.isfinite(arr64)), "vqt_magnitude.npy contains non-finite values."
    assert np.all(arr64 >= 0.0), (
        "vqt_magnitude.npy contains negative values; a magnitude must be non-negative."
    )
    ref = _reference_magnitude()
    assert ref.shape == arr64.shape, (
        f"Reference magnitude shape {ref.shape} does not match saved shape {arr64.shape}."
    )
    rel_err = float(np.linalg.norm(arr64 - ref) / (np.linalg.norm(ref) + 1e-12))
    assert rel_err <= MAG_REL_TOL, (
        f"Saved VQT magnitude differs from the reference VQT (gamma={GAMMA}) by relative "
        f"Frobenius error {rel_err:.4f} > {MAG_REL_TOL}. A Constant-Q or wrong-gamma "
        f"transform differs by roughly 0.4-0.5 and is not acceptable."
    )


def test_reconstructed_wav_properties():
    import soundfile as sf

    info = sf.info(RECON_WAV)
    assert info.samplerate == SR, (
        f"reconstructed.wav sample rate is {info.samplerate}, expected {SR}."
    )
    assert info.channels == 1, (
        f"reconstructed.wav has {info.channels} channels, expected mono (1)."
    )
    assert info.frames == EXPECTED_SAMPLES, (
        f"reconstructed.wav has {info.frames} samples, expected {EXPECTED_SAMPLES} "
        f"(identical length to the input)."
    )


def test_reconstruction_snr_meets_threshold():
    x = _load_original()
    x_hat, sr = _load_reconstruction()
    assert sr == SR, f"reconstructed.wav sample rate is {sr}, expected {SR}."
    assert len(x_hat) == EXPECTED_SAMPLES, (
        f"reconstructed.wav has {len(x_hat)} samples, expected {EXPECTED_SAMPLES}."
    )
    snr = _snr_db(x, x_hat)
    assert snr >= SNR_THRESHOLD_DB, (
        f"Reconstruction SNR is {snr:.2f} dB, which is below the required "
        f"{SNR_THRESHOLD_DB} dB. A phase-preserving inverse of the complex VQT is "
        f"required (magnitude-only reconstruction scores below 0 dB)."
    )


def test_report_json_contents():
    with open(REPORT_JSON) as f:
        report = json.load(f)

    assert isinstance(report, dict), "report.json must contain a JSON object."
    assert set(report.keys()) == {"snr_db", "vqt_shape"}, (
        f"report.json must contain exactly the keys 'snr_db' and 'vqt_shape', "
        f"but found: {sorted(report.keys())}."
    )

    shape = report["vqt_shape"]
    assert isinstance(shape, (list, tuple)) and len(shape) == 2, (
        f"report.json 'vqt_shape' must be a two-element array, got: {shape!r}."
    )
    assert [int(shape[0]), int(shape[1])] == [N_BINS, EXPECTED_FRAMES], (
        f"report.json 'vqt_shape' is {list(shape)}, expected {[N_BINS, EXPECTED_FRAMES]}."
    )

    reported_snr = report["snr_db"]
    assert isinstance(reported_snr, (int, float)) and not isinstance(reported_snr, bool), (
        f"report.json 'snr_db' must be a number, got: {reported_snr!r}."
    )
    reported_snr = float(reported_snr)
    assert reported_snr >= SNR_THRESHOLD_DB, (
        f"report.json 'snr_db' is {reported_snr:.2f}, below the required "
        f"{SNR_THRESHOLD_DB} dB."
    )

    x = _load_original()
    x_hat, _ = _load_reconstruction()
    recomputed = _snr_db(x, x_hat)
    assert abs(reported_snr - recomputed) <= SNR_REPORT_TOL_DB, (
        f"report.json 'snr_db' ({reported_snr:.2f}) disagrees with the SNR recomputed "
        f"from the artifacts ({recomputed:.2f}) by more than {SNR_REPORT_TOL_DB} dB."
    )
