#!/usr/bin/env python3
"""
Variable-Q Transform (VQT) analysis & resynthesis pipeline.

Reads a mono 22050 Hz audio clip, computes its VQT with a fixed set of
analysis parameters, saves the magnitude of the transform, reconstructs a
time-domain waveform from the (complex) transform, saves the reconstruction
as a WAV file, and reports the reconstruction SNR together with the VQT
shape as a JSON file.
"""
import json
import os

import numpy as np
import librosa
import soundfile as sf

PROJECT_DIR = "/home/user/vqt"
INPUT_PATH = os.path.join(PROJECT_DIR, "input", "signal.wav")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")

VQT_MAG_PATH = os.path.join(OUTPUT_DIR, "vqt_magnitude.npy")
RECON_WAV_PATH = os.path.join(OUTPUT_DIR, "reconstructed.wav")
REPORT_PATH = os.path.join(OUTPUT_DIR, "report.json")

# --- Fixed analysis parameters -------------------------------------------------
SR = 22050
FMIN = librosa.note_to_hz("C1")  # ~32.70 Hz
BINS_PER_OCTAVE = 36
N_BINS = 252
GAMMA = 3.0
HOP_LENGTH = 512


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load the input clip exactly as-is (no resampling).
    y, sr = librosa.load(INPUT_PATH, sr=SR, mono=True)
    n_samples = len(y)

    # Compute the Variable-Q Transform.
    V = librosa.vqt(
        y=y,
        sr=sr,
        fmin=FMIN,
        n_bins=N_BINS,
        bins_per_octave=BINS_PER_OCTAVE,
        gamma=GAMMA,
        hop_length=HOP_LENGTH,
    )

    # Output artifact 1: magnitude of the VQT (real-valued).
    V_mag = np.abs(V)
    np.save(VQT_MAG_PATH, V_mag)

    # Reconstruct a time-domain waveform from the complex VQT so that phase
    # information is preserved (required to reach a useful reconstruction
    # SNR). librosa's inverse constant-Q transform (icqt) is used as the
    # inverse operator; it is driven with the same sr/fmin/bins_per_octave/
    # hop_length used for the forward transform and is asked to produce
    # exactly n_samples output samples.
    y_hat = librosa.icqt(
        V,
        sr=sr,
        hop_length=HOP_LENGTH,
        fmin=FMIN,
        bins_per_octave=BINS_PER_OCTAVE,
        length=n_samples,
    )
    y_hat = np.asarray(y_hat, dtype=np.float32)

    # Output artifact 2: reconstructed waveform, same length as the input.
    sf.write(RECON_WAV_PATH, y_hat, sr, subtype="PCM_16")

    # Compute reconstruction SNR (dB).
    signal_power = np.sum(y.astype(np.float64) ** 2)
    noise_power = np.sum((y.astype(np.float64) - y_hat.astype(np.float64)) ** 2)
    snr_db = 10.0 * np.log10(signal_power / noise_power)

    # Output artifact 3: JSON report.
    report = {
        "snr_db": float(snr_db),
        "vqt_shape": [int(V.shape[0]), int(V.shape[1])],
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)

    print(f"VQT shape: {V.shape}")
    print(f"Reconstruction SNR: {snr_db:.2f} dB")
    print(f"Wrote: {VQT_MAG_PATH}")
    print(f"Wrote: {RECON_WAV_PATH}")
    print(f"Wrote: {REPORT_PATH}")


if __name__ == "__main__":
    main()
