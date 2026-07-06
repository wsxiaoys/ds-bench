#!/usr/bin/env python3
"""
Structural music segmentation using librosa 0.11.0.

Pipeline:
  1. Beat-track the input.
  2. Beat-synchronous tonal feature (CQT chroma).
  3. Recurrence (repetition) affinity + path enhancement.
  4. Combine with sequential (local) affinity.
  5. Symmetric normalized graph Laplacian -> bottom K eigenvectors.
  6. Agglomerative clustering -> section labels.
  7. Map back to absolute time intervals and write JSON.
"""

import json
import numpy as np
import librosa
import librosa.beat
import librosa.segment
from sklearn.cluster import AgglomerativeClustering


# ----------------------------------------------------------------------------- #
# 1. Load audio
# ----------------------------------------------------------------------------- #
INPUT_PATH = "/home/user/input.wav"
OUTPUT_PATH = "/home/user/segments.json"

y, sr = librosa.load(INPUT_PATH, sr=22050, mono=True)
duration = len(y) / float(sr)
print(f"[load] sr={sr} duration={duration:.3f}s samples={len(y)}")


# ----------------------------------------------------------------------------- #
# 2. Beat tracking
# ----------------------------------------------------------------------------- #
hop_length = 512
# Use onset_envelope explicitly to work around a librosa 0.11 issue where
# the default recomputation appears to fail on this audio.
onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
tempo, beat_frames = librosa.beat.beat_track(
    onset_envelope=onset_env, sr=sr, hop_length=hop_length, sparse=True
)
tempo_val = float(np.atleast_1d(tempo)[0])
print(f"[beat] tempo={tempo_val:.2f} BPM #beats={len(beat_frames)}")

# Frames referenced against chroma length
n_frames = 1 + len(y) // hop_length


# ----------------------------------------------------------------------------- #
# 3. Beat-synchronous chroma feature (via CQT)
# ----------------------------------------------------------------------------- #
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
print(f"[chroma] shape={chroma.shape}")

# Sync the chroma to beat frames (with edge frame fixed)
beat_chroma = librosa.util.sync(chroma, beat_frames, aggregate=np.median)
print(f"[sync] beat_chroma shape={beat_chroma.shape}")

# L2-normalize columns for cosine-style similarity stability
beat_norms = np.linalg.norm(beat_chroma, axis=0, keepdims=True)
beat_norms[beat_norms == 0] = 1.0
beat_chroma_norm = beat_chroma / beat_norms


# ----------------------------------------------------------------------------- #
# 4. Recurrence / repetition affinity + path enhancement
# ----------------------------------------------------------------------------- #
# Use 'affinity' mode so path_enhance works on similarity directly.
R = librosa.segment.recurrence_matrix(
    beat_chroma_norm,
    mode="affinity",
    metric="cosine",
    sym=True,
    self=True,
    bandwidth=3.0,
)
print(f"[recurrence] R shape={R.shape}")

# Path-enhance the diagonals to follow musical repetitions
n_beats = beat_chroma_norm.shape[1]
R_path = librosa.segment.path_enhance(R, n_beats)
# Make symmetric and keep in [0, 1]
R_path = np.maximum(R_path, R_path.T)
np.clip(R_path, 0.0, 1.0, out=R_path)


# ----------------------------------------------------------------------------- #
# 5. Sequential (local) affinity and combination
# ----------------------------------------------------------------------------- #
# Local affinity decays exponentially with distance along the time axis.
# Only adjacent and near-adjacent beats are considered "sequential".
seq = np.zeros((n_beats, n_beats), dtype=np.float64)
sigma = 1.0  # width of locality in beat units
for i in range(n_beats):
    lo = max(0, i - 3)
    hi = min(n_beats, i + 4)
    for j in range(lo, hi):
        d = abs(i - j)
        seq[i, j] = np.exp(-(d ** 2) / (2.0 * sigma ** 2))
# Symmetric
seq = 0.5 * (seq + seq.T)

# Combine repetition + sequential
W = 0.7 * R_path + 0.3 * seq
np.fill_diagonal(W, 1.0)
W = 0.5 * (W + W.T)
np.clip(W, 0.0, 1.0, out=W)
print(f"[combine] W shape={W.shape} min={W.min():.4f} max={W.max():.4f}")


# ----------------------------------------------------------------------------- #
# 6. Symmetric normalized graph Laplacian + embedding
# ----------------------------------------------------------------------------- #
# L_sym = I - D^{-1/2} W D^{-1/2}
deg = W.sum(axis=1)
deg[deg == 0] = 1.0
d_inv_sqrt = 1.0 / np.sqrt(deg)
L = np.eye(n_beats) - (d_inv_sqrt[:, None] * W) * d_inv_sqrt[None, :]
# Symmetrize numerically
L = 0.5 * (L + L.T)

# Eigendecomposition - symmetric -> eigh
eigvals, eigvecs = np.linalg.eigh(L)
# Sort by eigenvalue ascending (most negative / smallest first for L_sym)
order = np.argsort(eigvals)
eigvals = eigvals[order]
eigvecs = eigvecs[:, order]

K = 5  # number of eigenvectors to use as embedding
# Skip the first trivial eigenvector (constant ~0 eigenvalue).
# Using the K smallest *non-trivial* eigenvectors.
embed = eigvecs[:, 1 : 1 + K]
print(f"[laplacian] eigvals[0:6]={eigvals[:6]}")
print(f"[embed] shape={embed.shape}")

# Row-normalize the embedding (Fiedler-style)
row_norms = np.linalg.norm(embed, axis=1, keepdims=True)
row_norms[row_norms == 0] = 1.0
embed_norm = embed / row_norms


# ----------------------------------------------------------------------------- #
# 7. Agglomerative clustering (temporally constrained)
# ----------------------------------------------------------------------------- #
n_clusters = 3
clusterer = AgglomerativeClustering(
    n_clusters=n_clusters,
    metric="euclidean",
    linkage="ward",
    connectivity=None,
)
labels = clusterer.fit_predict(embed_norm)
print(f"[cluster] labels[:30]={labels[:30]}")
print(f"[cluster] unique={np.unique(labels, return_counts=True)}")


# ----------------------------------------------------------------------------- #
# 8. Map beat labels to time intervals
# ----------------------------------------------------------------------------- #
# beat_chroma has shape (12, n_beats_sync) where n_beats_sync == len(beat_frames) + 1
# (librosa.util.sync pads an end boundary). Construct matching boundary frames.
n_beats_sync = beat_chroma.shape[1]
boundary_frames = librosa.util.fix_frames(
    beat_frames,
    x_min=0,
    x_max=n_frames - 1,
    pad=True,
)
# Append the trailing frame to close out the last beat
if boundary_frames[-1] != n_frames - 1:
    boundary_frames = np.append(boundary_frames, n_frames - 1)
# Ensure first frame is 0 for nice absolute start
if boundary_frames[0] != 0:
    boundary_frames[0] = 0

# We need exactly n_beats_sync + 1 boundaries so beat_times can be indexed by
# e_idx up to n_beats_sync (exclusive end of last run). Append a final
# boundary equal to the last chroma frame if not already present.
if len(boundary_frames) < n_beats_sync + 1:
    boundary_frames = np.append(boundary_frames, n_frames - 1)

beat_times = librosa.frames_to_time(boundary_frames, sr=sr, hop_length=hop_length)
print(
    f"[boundary] n_boundaries={len(boundary_frames)} n_labels={len(labels)} "
    f"times[0:5]={beat_times[:5]} ... times[-3:]={beat_times[-3:]}"
)


def contiguous_runs(lbls: np.ndarray):
    """Convert per-beat labels into (start_idx, end_idx, label) runs."""
    if len(lbls) == 0:
        return []
    runs = []
    cur_label = lbls[0]
    start_idx = 0
    for i in range(1, len(lbls)):
        if lbls[i] != cur_label:
            runs.append((start_idx, i, cur_label))
            cur_label = lbls[i]
            start_idx = i
    runs.append((start_idx, len(lbls), cur_label))
    return runs


runs = contiguous_runs(labels)


def runs_to_absolute(runs, times):
    """Convert (start_idx, end_idx, label) -> (start_s, end_s, label)."""
    out = []
    for s_idx, e_idx, lbl in runs:
        s = float(times[s_idx])
        e = float(times[e_idx])
        if e <= s:
            e = s + 0.5
        out.append((s, e, int(lbl)))
    return out


abs_runs = runs_to_absolute(runs, beat_times)


# Force first start to be ~0 and last end to be ~duration.
def tighten_boundaries(runs, duration):
    if not runs:
        return runs
    runs[0] = (0.0, runs[0][1], runs[0][2])
    last_s, last_e, last_l = runs[-1]
    if last_e < duration - 0.5:
        last_e = duration
    runs[-1] = (last_s, last_e, last_l)
    return runs


abs_runs = tighten_boundaries(abs_runs, duration)


# Collapse runs that are too short (< 0.5s) by merging into a neighbor.
def merge_short(runs, min_dur=0.5):
    changed = True
    while changed:
        changed = False
        out = []
        for s, e, l in runs:
            dur = e - s
            if dur < min_dur and out:
                ps, pe, pl = out[-1]
                out[-1] = (ps, e, pl)
                changed = True
            elif dur < min_dur and not out:
                # First segment too short - extend end to next run later
                out.append((s, e, l))
            else:
                out.append((s, e, l))
        runs = out
    return runs


abs_runs = merge_short(abs_runs, min_dur=0.5)
# Re-tighten
abs_runs = tighten_boundaries(abs_runs, duration)


# Re-label clusters as A, B, C, ... by first-appearance order.
def relabel_letters(runs):
    seen = {}
    next_id = 0
    relabeled = []
    for s, e, l in runs:
        if l not in seen:
            seen[l] = next_id
            next_id += 1
        letter = chr(ord("A") + seen[l])
        relabeled.append((s, e, letter))
    return relabeled


final_runs = relabel_letters(abs_runs)


# Build JSON output
segments = [
    {"start": float(round(s, 6)), "end": float(round(e, 6)), "label": lbl}
    for s, e, lbl in final_runs
    if e > s and (e - s) > 0.5
]


# Last sanity tightening
if segments:
    segments[0]["start"] = 0.0
    segments[-1]["end"] = float(duration)


print("[segments]")
for seg in segments:
    print(f"  {seg}")

with open(OUTPUT_PATH, "w") as f:
    json.dump(segments, f, indent=2)
print(f"[write] {OUTPUT_PATH} (n={len(segments)})")