"""Compute a stacked multi-resolution spectrogram (STFT + CQT + VQT) and
persist the dB-scaled magnitudes plus a metadata sidecar JSON."""

import json

import librosa
import numpy as np

INPUT_WAV = "/home/user/input.wav"
OUT_NPZ = "/home/user/spec_stack.npz"
OUT_META = "/home/user/spec_meta.json"

# ---- Analysis parameters ---------------------------------------------------
n_fft = 2048
hop_length = 512                 # power of two, divisible by 2**(n_octaves-1)
cqt_n_bins = 84
cqt_bins_per_octave = 12
vqt_n_bins = 84
vqt_bins_per_octave = 12
fmin = float(librosa.note_to_hz("C1"))   # librosa's default CQT/VQT fmin

# ---- Load audio ------------------------------------------------------------
y, sr = librosa.load(INPUT_WAV, sr=None)

# ---- Compute the three transforms on a shared time grid --------------------
stft_mag = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
cqt_mag = np.abs(librosa.cqt(
    y, sr=sr, hop_length=hop_length, fmin=fmin,
    n_bins=cqt_n_bins, bins_per_octave=cqt_bins_per_octave,
))
vqt_mag = np.abs(librosa.vqt(
    y, sr=sr, hop_length=hop_length, fmin=fmin,
    n_bins=vqt_n_bins, bins_per_octave=vqt_bins_per_octave,
    intervals="equal",
))

# ---- Sanity: frames must agree across representations ----------------------
assert stft_mag.shape[1] == cqt_mag.shape[1] == vqt_mag.shape[1], (
    f"Frame mismatch: STFT={stft_mag.shape[1]} CQT={cqt_mag.shape[1]} "
    f"VQT={vqt_mag.shape[1]}"
)

# ---- Convert magnitudes to dB ---------------------------------------------
stft_db = librosa.amplitude_to_db(stft_mag, ref=np.max)
cqt_db = librosa.amplitude_to_db(cqt_mag, ref=np.max)
vqt_db = librosa.amplitude_to_db(vqt_mag, ref=np.max)

# ---- Derive frequency vectors from librosa helpers ------------------------
stft_freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
cqt_freqs = librosa.cqt_frequencies(
    cqt_n_bins, fmin=fmin, bins_per_octave=cqt_bins_per_octave,
)
vqt_freqs = librosa.interval_frequencies(
    vqt_n_bins, fmin=fmin, intervals="equal",
    bins_per_octave=vqt_bins_per_octave,
)

# ---- Persist arrays --------------------------------------------------------
np.savez(OUT_NPZ, stft_db=stft_db, cqt_db=cqt_db, vqt_db=vqt_db)

# ---- Persist metadata ------------------------------------------------------
metadata = {
    "n_frames": int(stft_db.shape[1]),
    "hop_length": int(hop_length),
    "sample_rate": int(sr),
    "stft_freqs": [float(x) for x in stft_freqs],
    "cqt_freqs": [float(x) for x in cqt_freqs],
    "vqt_freqs": [float(x) for x in vqt_freqs],
    "n_fft": int(n_fft),
    "cqt_n_bins": int(cqt_n_bins),
    "cqt_bins_per_octave": int(cqt_bins_per_octave),
    "vqt_n_bins": int(vqt_n_bins),
    "vqt_bins_per_octave": int(vqt_bins_per_octave),
}

with open(OUT_META, "w") as f:
    json.dump(metadata, f, indent=2)

print("STFT dB:", stft_db.shape, "range", float(stft_db.min()), float(stft_db.max()))
print("CQT  dB:", cqt_db.shape, "range", float(cqt_db.min()), float(cqt_db.max()))
print("VQT  dB:", vqt_db.shape, "range", float(vqt_db.min()), float(vqt_db.max()))
print("n_frames:", metadata["n_frames"])
print("Wrote", OUT_NPZ, "and", OUT_META)