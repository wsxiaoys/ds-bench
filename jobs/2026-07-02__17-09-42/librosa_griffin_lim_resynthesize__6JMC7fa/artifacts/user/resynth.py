#!/usr/bin/env python3
"""
Mel-spectrogram analysis / resynthesis pipeline with librosa.

Pipeline:
  1. Load /home/user/input.wav as mono, native sample rate.
  2. Compute a 128-band power mel spectrogram (n_fft=2048, hop_length=512).
  3. Represent it in log-power form (dB) for storage / downstream use.
  4. Convert the log-power back to linear power and run Griffin-Lim
     through the librosa mel-to-audio convenience wrapper to invert
     the mel representation back to a waveform.
  5. Write the reconstruction to /home/user/reconstructed.wav at the
     same sample rate, using the original sample count as the target
     length (enforced by mel_to_audio's `length` argument).
  6. Compute spectral convergence (Frobenius ratio) and SNR against
     the original and dump both, along with run metadata, to
     /home/user/metrics.json.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import soundfile as sf

import librosa


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INPUT_PATH = Path("/home/user/input.wav")
OUTPUT_PATH = Path("/home/user/reconstructed.wav")
METRICS_PATH = Path("/home/user/metrics.json")

N_FFT = 2048           # FFT size for STFT / mel analysis & inversion
HOP_LENGTH = 512       # Hop length for STFT / mel analysis & inversion
N_MELS = 128           # Number of mel bands (>= 128)
WIN_LENGTH = N_FFT     # Hann window equal to n_fft
WINDOW = "hann"
CENTER = True          # Use centered frames (matches default stft)
POWER = 2.0            # melspectrogram power exponent (linear power)
N_ITER = 64            # Griffin-Lim iterations (>= 32)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def load_mono(path: Path) -> tuple[np.ndarray, int]:
    """Read a WAV file as mono, returning (y, sr)."""
    y, sr = sf.read(str(path), always_2d=False)
    if y.ndim > 1:
        y = np.mean(y, axis=1)
    return y.astype(np.float64, copy=False), int(sr)


def compute_mel_log_power(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray, float]:
    """Compute the mel power spectrogram and return its dB (log-power) form.

    Returns (mel_power, mel_log_db, ref) where `ref` is the reference value
    used for the dB conversion (so the round-trip back to linear power is
    exact: db_to_power(mel_log_db, ref=ref) == mel_power).
    """
    mel_power = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        win_length=WIN_LENGTH,
        window=WINDOW,
        center=CENTER,
        power=POWER,
        n_mels=N_MELS,
    )
    # Make sure ref is a plain Python float (numpy 2.x doesn't multiply
    # ArrayFunctionDispatcher objects).
    ref = float(mel_power.max())
    mel_log_db = librosa.power_to_db(mel_power, ref=ref)
    return mel_power, mel_log_db, ref


def resynth_from_mel_power(
    mel_power: np.ndarray,
    sr: int,
    length: int,
) -> np.ndarray:
    """Invert a mel power spectrogram to a time-domain waveform via Griffin-Lim."""
    y_rec = librosa.feature.inverse.mel_to_audio(
        mel_power,
        sr=sr,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        win_length=WIN_LENGTH,
        window=WINDOW,
        center=CENTER,
        power=POWER,
        n_iter=N_ITER,
        length=length,
    )
    return np.asarray(y_rec, dtype=np.float64)


def spectral_convergence(y_ref: np.ndarray, y_rec: np.ndarray) -> float:
    """Frobenius ratio || |S_ref| - |S_rec| ||_F / || |S_ref| ||_F."""
    S_ref = np.abs(librosa.stft(y_ref, n_fft=N_FFT, hop_length=HOP_LENGTH))
    S_rec = np.abs(librosa.stft(y_rec, n_fft=N_FFT, hop_length=HOP_LENGTH))
    num = np.linalg.norm(S_ref - S_rec, ord="fro")
    den = np.linalg.norm(S_ref, ord="fro")
    if den == 0.0:
        return float("nan")
    return float(num / den)


def snr_db(y_ref: np.ndarray, y_rec: np.ndarray) -> float:
    """SNR treating `y_ref` as signal and `y_ref - y_rec` as noise.

    Both inputs are truncated to a common length.  Per the spec:
        10 * log10( sum(ref^2) / sum((ref - rec)^2) ).
    """
    n = min(len(y_ref), len(y_rec))
    ref = y_ref[:n]
    rec = y_rec[:n]
    noise = ref - rec
    sig_power = float(np.sum(ref * ref))
    noise_power = float(np.sum(noise * noise))
    if noise_power == 0.0:
        return float("inf")
    return 10.0 * np.log10(sig_power / noise_power)


def write_wav(path: Path, y: np.ndarray, sr: int) -> None:
    """Write a mono float64 WAV at the given sample rate."""
    sf.write(str(path), y.astype(np.float64, copy=False), sr, subtype="FLOAT")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def main() -> None:
    # 1) Read the input audio as mono at its native sample rate.
    y, sr = load_mono(INPUT_PATH)
    n_samples_in = len(y)

    # 2) + 3) Compute the mel power spectrogram and its log-power form.
    mel_power, mel_log_db, ref = compute_mel_log_power(y, sr)

    # Sanity check: round-tripping log-power -> power should reconstruct
    # the original mel_power (modulo the amin floor of power_to_db).
    mel_power_rt = librosa.db_to_power(mel_log_db, ref=ref)
    rt_err = float(np.max(np.abs(mel_power_rt - mel_power)))
    print(f"[info] mel log<->power round-trip max abs error: {rt_err:.3e}")

    # 4) Resynthesize from the mel power spectrogram (Griffin-Lim).
    y_rec = resynth_from_mel_power(mel_power, sr, length=n_samples_in)

    # The `length` argument on mel_to_audio enforces exactly the desired
    # number of samples, but be defensive in case rounding ever leaves
    # us one or two samples off.
    if len(y_rec) != n_samples_in:
        if len(y_rec) > n_samples_in:
            y_rec = y_rec[:n_samples_in]
        else:
            y_rec = np.pad(y_rec, (0, n_samples_in - len(y_rec)))

    # 5) Write the reconstructed waveform.
    write_wav(OUTPUT_PATH, y_rec, sr)

    # 6) Compute metrics and persist them as JSON.
    sc = spectral_convergence(y, y_rec)
    snr = snr_db(y, y_rec)
    metrics = {
        "spectral_convergence": sc,
        "snr_db": snr,
        "length_samples": int(len(y_rec)),
        "sample_rate": int(sr),
        "n_mels": int(N_MELS),
        "n_iter": int(N_ITER),
    }

    METRICS_PATH.write_text(json.dumps(metrics, indent=2))

    # Pretty log for visibility.
    print(f"[info] sr              = {sr}")
    print(f"[info] samples (in)    = {n_samples_in}")
    print(f"[info] samples (out)   = {len(y_rec)}")
    print(f"[info] length delta    = {abs(len(y_rec) - n_samples_in) / n_samples_in * 100:.4f}%")
    print(f"[info] mel shape       = {mel_power.shape}")
    print(f"[info] spectral_conv   = {sc:.6f}   (target < 0.5)")
    print(f"[info] snr_db          = {snr:.4f}  (target > 0.0)")
    print(f"[info] wrote           = {OUTPUT_PATH}")
    print(f"[info] metrics         = {METRICS_PATH}")


if __name__ == "__main__":
    main()
