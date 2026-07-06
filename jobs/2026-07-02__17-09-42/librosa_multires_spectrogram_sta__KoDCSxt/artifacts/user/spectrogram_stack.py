"""Compute a stacked multi-resolution spectrogram (STFT + CQT + VQT) on a shared time grid."""
import json

import librosa
import numpy as np


def main():
    # --- Configuration ----------------------------------------------------
    input_wav = "/home/user/input.wav"
    npz_path = "/home/user/spec_stack.npz"
    meta_path = "/home/user/spec_meta.json"

    # STFT parameters
    n_fft = 2048
    # Shared time-grid parameter: power of two and divisible by 2^(n_octaves-1).
    # With n_bins=84, bins_per_octave=12 -> n_octaves = 7 -> need 2**6 = 64.
    hop_length = 512

    # CQT parameters
    cqt_n_bins = 84
    cqt_bins_per_octave = 12
    cqt_fmin = librosa.note_to_hz("C1")

    # VQT parameters
    vqt_n_bins = 84
    vqt_bins_per_octave = 12
    vqt_fmin = librosa.note_to_hz("C1")

    # --- Load audio -------------------------------------------------------
    y, sample_rate = librosa.load(input_wav, sr=None, mono=True)

    # --- Compute transforms on the shared time grid -----------------------
    stft_complex = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    cqt_complex = librosa.cqt(
        y,
        sr=sample_rate,
        hop_length=hop_length,
        fmin=cqt_fmin,
        n_bins=cqt_n_bins,
        bins_per_octave=cqt_bins_per_octave,
    )
    vqt_complex = librosa.vqt(
        y,
        sr=sample_rate,
        hop_length=hop_length,
        fmin=vqt_fmin,
        n_bins=vqt_n_bins,
        bins_per_octave=vqt_bins_per_octave,
        intervals="equal",
    )

    # --- Magnitudes -> dB -------------------------------------------------
    stft_db = librosa.amplitude_to_db(np.abs(stft_complex), ref=np.max)
    cqt_db = librosa.amplitude_to_db(np.abs(cqt_complex), ref=np.max)
    vqt_db = librosa.amplitude_to_db(np.abs(vqt_complex), ref=np.max)

    # All three must share the same number of frames.
    n_frames = stft_db.shape[1]
    assert cqt_db.shape[1] == n_frames, (
        f"CQT frame count {cqt_db.shape[1]} != STFT frame count {n_frames}"
    )
    assert vqt_db.shape[1] == n_frames, (
        f"VQT frame count {vqt_db.shape[1]} != STFT frame count {n_frames}"
    )

    # --- Frequency vectors derived from librosa helpers -------------------
    stft_freqs = librosa.fft_frequencies(sr=sample_rate, n_fft=n_fft)
    cqt_freqs = librosa.cqt_frequencies(
        n_bins=cqt_n_bins,
        fmin=cqt_fmin,
        bins_per_octave=cqt_bins_per_octave,
    )
    vqt_freqs = librosa.interval_frequencies(
        n_bins=vqt_n_bins,
        fmin=vqt_fmin,
        intervals="equal",
        bins_per_octave=vqt_bins_per_octave,
    )

    # --- Save spectrogram stack -------------------------------------------
    np.savez(npz_path, stft_db=stft_db, cqt_db=cqt_db, vqt_db=vqt_db)

    # --- Save metadata sidecar (JSON-serializable) ------------------------
    metadata = {
        "n_frames": int(n_frames),
        "hop_length": int(hop_length),
        "sample_rate": int(sample_rate),
        "stft_freqs": [float(f) for f in stft_freqs],
        "cqt_freqs": [float(f) for f in cqt_freqs],
        "vqt_freqs": [float(f) for f in vqt_freqs],
        "n_fft": int(n_fft),
        "cqt_n_bins": int(cqt_n_bins),
        "cqt_bins_per_octave": int(cqt_bins_per_octave),
        "vqt_n_bins": int(vqt_n_bins),
        "vqt_bins_per_octave": int(vqt_bins_per_octave),
    }
    with open(meta_path, "w") as fp:
        json.dump(metadata, fp, indent=2)

    # --- Diagnostics ------------------------------------------------------
    print(f"y.shape            = {y.shape}")
    print(f"sample_rate        = {sample_rate}")
    print(f"hop_length         = {hop_length}")
    print(f"n_fft              = {n_fft}")
    print(f"stft_db.shape      = {stft_db.shape}")
    print(f"cqt_db.shape       = {cqt_db.shape}")
    print(f"vqt_db.shape       = {vqt_db.shape}")
    print(f"n_frames           = {n_frames}")
    print(f"len(stft_freqs)    = {len(stft_freqs)}")
    print(f"len(cqt_freqs)     = {len(cqt_freqs)}")
    print(f"len(vqt_freqs)     = {len(vqt_freqs)}")
    print(f"Saved {npz_path}")
    print(f"Saved {meta_path}")


if __name__ == "__main__":
    main()