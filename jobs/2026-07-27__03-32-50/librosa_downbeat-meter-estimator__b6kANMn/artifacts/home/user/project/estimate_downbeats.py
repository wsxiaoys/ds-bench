#!/usr/bin/env python3
"""
Downbeat & time-signature (meter) estimator.

Reads a mono WAV file containing a steady percussive rhythm, tracks the
beats, derives a beat-synchronous accent signal (combining onset-strength
and chroma-based harmonic novelty), estimates the meter (beats per bar)
from candidates {2, 3, 4, 6}, locates the downbeat phase, and writes the
results as JSON.

Usage:
    python3 estimate_downbeats.py --input <input_wav_path> --output <output_json_path>
"""

import argparse
import json

import numpy as np
import librosa


CANDIDATE_METERS = (2, 3, 4, 6)


def zscore(x: np.ndarray) -> np.ndarray:
    """Normalize a 1D signal to zero mean / unit variance (safe for zero std)."""
    x = np.asarray(x, dtype=float)
    std = x.std()
    if std < 1e-12:
        return np.zeros_like(x)
    return (x - x.mean()) / std


def _beat_windows(beat_frames: np.ndarray, n_frames: int) -> list:
    """
    Compute a (lo, hi) frame window centered on each beat frame, sized as a
    fraction of the local beat spacing. Windows are index-aligned 1:1 with
    `beat_frames` (unlike `librosa.util.sync`, which can insert extra leading
    / trailing segments when the first beat frame is not exactly 0).
    """
    n = len(beat_frames)
    if n == 1:
        spacing = max(n_frames // 4, 1)
    else:
        spacing = int(np.median(np.diff(beat_frames)))
        spacing = max(spacing, 1)
    half = max(spacing // 4, 1)

    windows = []
    for center in beat_frames:
        lo = max(0, int(center) - half)
        hi = min(n_frames, int(center) + half + 1)
        if hi <= lo:
            hi = min(n_frames, lo + 1)
        windows.append((lo, hi))
    return windows


def beat_synchronous_onset_accent(y: np.ndarray, sr: float, beat_frames: np.ndarray,
                                   hop_length: int) -> np.ndarray:
    """Per-beat accent derived from the onset-strength envelope."""
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    windows = _beat_windows(beat_frames, onset_env.shape[-1])
    # Max within a small window centered on each beat highlights strong
    # percussive attacks (accents) occurring at that beat, while staying
    # exactly index-aligned with `beat_frames`.
    accent = np.array([onset_env[lo:hi].max() for lo, hi in windows], dtype=float)
    return accent


def beat_synchronous_chroma_novelty(y: np.ndarray, sr: float, beat_frames: np.ndarray,
                                     hop_length: int) -> np.ndarray:
    """Per-beat accent derived from beat-synchronous chroma (harmonic change)."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    windows = _beat_windows(beat_frames, chroma.shape[-1])
    chroma_beats = np.stack([chroma[:, lo:hi].mean(axis=1) for lo, hi in windows], axis=1)

    # Normalize each beat's chroma vector so novelty measures shape change,
    # not overall loudness.
    norms = np.linalg.norm(chroma_beats, axis=0, keepdims=True)
    norms[norms < 1e-12] = 1.0
    chroma_norm = chroma_beats / norms

    n = chroma_norm.shape[1]
    novelty = np.zeros(n, dtype=float)
    if n > 1:
        # Cosine distance between consecutive beats' chroma vectors: a large
        # harmonic change often signals a new bar / downbeat.
        cos_sim = np.sum(chroma_norm[:, 1:] * chroma_norm[:, :-1], axis=0)
        novelty[1:] = 1.0 - cos_sim
        # First beat has no predecessor; give it the mean novelty so it does
        # not artificially bias the phase search toward index 0.
        novelty[0] = novelty[1:].mean()
    return novelty


def score_meter(accent: np.ndarray, meter: int) -> float:
    """
    Score how well `meter` explains the periodicity of `accent` using a
    one-way ANOVA F-statistic: group beats by (index mod meter) and compare
    between-group variance to within-group variance. This is comparable
    across different candidate meters (unlike a raw peak-to-average ratio),
    since it accounts for both the number of groups and the residual noise.
    """
    n = len(accent)
    if n < meter:
        return -np.inf

    groups = [accent[phase::meter] for phase in range(meter)]
    # Need at least 2 full-ish observations per group and more than one group.
    if any(len(g) == 0 for g in groups):
        return -np.inf

    grand_mean = accent.mean()
    group_means = np.array([g.mean() for g in groups])
    group_sizes = np.array([len(g) for g in groups])

    between = np.sum(group_sizes * (group_means - grand_mean) ** 2) / max(meter - 1, 1)

    within_terms = []
    within_dof = 0
    for g in groups:
        if len(g) > 1:
            within_terms.append(np.sum((g - g.mean()) ** 2))
            within_dof += len(g) - 1
    within = (sum(within_terms) / within_dof) if within_dof > 0 else 1e-12
    within = max(within, 1e-12)

    return between / within


def best_phase(accent: np.ndarray, meter: int) -> int:
    """Pick the phase in [0, meter) whose beats have the largest total accent."""
    totals = [accent[phase::meter].sum() for phase in range(meter)]
    return int(np.argmax(totals))


def main() -> None:
    parser = argparse.ArgumentParser(description="Estimate meter and downbeats from a WAV file.")
    parser.add_argument("--input", required=True, help="Path to input WAV file.")
    parser.add_argument("--output", required=True, help="Path to output JSON file.")
    args = parser.parse_args()

    hop_length = 512

    y, sr = librosa.load(args.input, sr=None, mono=True)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=hop_length, trim=False, units="frames"
    )
    tempo = float(np.asarray(tempo).reshape(-1)[0])

    beat_frames = np.asarray(beat_frames, dtype=int)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)

    n_beats = len(beat_frames)
    if n_beats < 2:
        # Degenerate case: not enough beats to determine a meter/phase.
        result = {
            "tempo": tempo,
            "beat_times": [float(t) for t in beat_times],
            "meter": CANDIDATE_METERS[0],
            "downbeat_indices": [0] if n_beats > 0 else [],
            "downbeat_times": [float(beat_times[0])] if n_beats > 0 else [],
        }
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2)
        return

    onset_accent = beat_synchronous_onset_accent(y, sr, beat_frames, hop_length)
    chroma_novelty = beat_synchronous_chroma_novelty(y, sr, beat_frames, hop_length)

    accent = 0.5 * zscore(onset_accent) + 0.5 * zscore(chroma_novelty)

    valid_meters = [m for m in CANDIDATE_METERS if n_beats >= m]
    if not valid_meters:
        valid_meters = [CANDIDATE_METERS[0]]

    scores = {m: score_meter(accent, m) for m in valid_meters}
    meter = max(valid_meters, key=lambda m: scores[m])

    phase = best_phase(accent, meter)

    downbeat_indices = list(range(phase, n_beats, meter))
    downbeat_times = [float(beat_times[i]) for i in downbeat_indices]

    result = {
        "tempo": tempo,
        "beat_times": [float(t) for t in beat_times],
        "meter": int(meter),
        "downbeat_indices": [int(i) for i in downbeat_indices],
        "downbeat_times": downbeat_times,
    }

    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)


if __name__ == "__main__":
    main()
