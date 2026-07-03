#!/usr/bin/env python3
"""Laplacian structural music segmentation pipeline.

Recovers song-section boundaries and re-uses cluster identities (A/B/A...)
across repeating sections using beat-synchronous tonal features, a path-enhanced
recurrence graph mixed with sequential affinity, and spectral clustering via
the symmetric normalized graph Laplacian.
"""

import json

import numpy as np
import librosa


def main():
    # ------------------------------------------------------------------
    # 1. Load audio
    # ------------------------------------------------------------------
    y, sr = librosa.load("/home/user/input.wav", sr=22050, mono=True)
    duration = len(y) / sr

    hop_length = 512

    # ------------------------------------------------------------------
    # 2. Beat tracking
    # ------------------------------------------------------------------
    # Compute the onset strength envelope explicitly; beat_track with the
    # default prior on this audio returns an empty beat set, so we supply
    # the onset envelope directly which yields a robust estimate.
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)

    tempo, beat_frames = librosa.beat.beat_track(
        onset_envelope=onset_env, sr=sr, hop_length=hop_length,
        units="frames", tightness=100, trim=False,
    )

    # Ensure beat frames span the full duration: prepend 0 and append the
    # last frame so the beat-synchronous features cover the entire track.
    beat_frames = librosa.util.fix_frames(beat_frames, x_min=0, x_max=None, pad=True)

    # ------------------------------------------------------------------
    # 3. Tonal feature extraction (chroma_cqt) + beat sync
    # ------------------------------------------------------------------
    chroma = librosa.feature.chroma_cqt(
        y=y, sr=sr, hop_length=hop_length, n_chroma=12, n_octaves=7
    )

    # Beat-synchronous aggregation via median.
    chroma_sync = librosa.util.sync(
        chroma, beat_frames, aggregate=np.median, axis=-1, pad=True
    )

    # L2-normalize each beat frame's chroma vector for cleaner recurrence.
    chroma_sync = librosa.util.normalize(chroma_sync, axis=0)

    n_beats = chroma_sync.shape[1]

    # ------------------------------------------------------------------
    # 4. Recurrence matrix + path enhancement
    # ------------------------------------------------------------------
    # k: number of nearest neighbors for recurrence. Scale with size, but cap.
    k = max(2, min(int(0.03 * n_beats), 8))

    R = librosa.segment.recurrence_matrix(
        chroma_sync,
        k=k,
        width=3,
        metric="cosine",
        sym=True,
        sparse=False,
        mode="affinity",
        self=False,
        axis=-1,
    )

    # Enhance diagonal paths in the recurrence matrix.
    R_path = librosa.segment.path_enhance(
        R, n=15, window="hann", max_ratio=2.0, min_ratio=1.5, n_filters=7,
        zero_mean=True, clip=True,
    )

    # ------------------------------------------------------------------
    # 5. Sequential (local) affinity term
    # ------------------------------------------------------------------
    # Build a local affinity that connects temporally adjacent beats with a
    # decaying weight so the graph also encodes sequential continuity.
    seq = np.zeros((n_beats, n_beats), dtype=float)
    bandwidth = 2.0  # frames over which sequential affinity decays
    for i in range(n_beats):
        for j in range(max(0, i - 5), min(n_beats, i + 6)):
            if i == j:
                continue
            seq[i, j] = np.exp(-((i - j) ** 2) / (2 * bandwidth ** 2))

    # Symmetrize sequential term.
    seq = (seq + seq.T) / 2.0

    # ------------------------------------------------------------------
    # 6. Combine repetition + sequential into symmetric weighted adjacency
    # ------------------------------------------------------------------
    rep_weight = 0.9   # weight for path-enhanced repetition
    seq_weight = 0.1   # weight for sequential affinity

    W = rep_weight * R_path + seq_weight * seq

    # Symmetrize to be safe.
    W = (W + W.T) / 2.0

    # Remove self-loops.
    np.fill_diagonal(W, 0.0)

    # ------------------------------------------------------------------
    # 7. Symmetric normalized graph Laplacian
    # ------------------------------------------------------------------
    d = W.sum(axis=1)
    # Guard against isolated nodes.
    d_safe = np.where(d > 0, d, 1.0)
    D_inv_sqrt = np.diag(1.0 / np.sqrt(d_safe))

    L_sym = np.eye(n_beats) - D_inv_sqrt @ W @ D_inv_sqrt

    # ------------------------------------------------------------------
    # 8. Eigendecomposition -> bottom eigenvectors
    # ------------------------------------------------------------------
    # Number of eigenvectors K (embedding dimension).
    K = 4
    # Number of section-type clusters.
    n_clusters = 3

    eigvals, eigvecs = np.linalg.eigh(L_sym)

    # Select the bottom K eigenvectors (skip the very first trivial one).
    embedding = eigvecs[:, 1:1 + K]

    # Row-normalize the embedding (standard spectral clustering step).
    norms = np.linalg.norm(embedding, axis=1, keepdims=True)
    norms_safe = np.where(norms > 0, norms, 1.0)
    embedding = embedding / norms_safe

    # ------------------------------------------------------------------
    # 9. Temporally-constrained agglomerative clustering
    # ------------------------------------------------------------------
    # librosa.segment.agglomerative performs temporal-constrained clustering
    # along the time axis, merging only temporally adjacent segments.
    boundaries = librosa.segment.agglomerative(
        embedding, k=n_clusters, axis=0
    )

    # boundaries are frame indices (in beat-index space) where new segments
    # begin. Convert to a per-beat label array.
    labels = np.zeros(n_beats, dtype=int)
    for idx, b in enumerate(boundaries):
        labels[b:] = idx

    # ------------------------------------------------------------------
    # 10. Re-identify clusters so repeated sections share labels
    # ------------------------------------------------------------------
    # agglomerative already assigns consistent ids to contiguous regions,
    # but different regions may share an id only if they are merged via
    # temporal constraints. To re-use identities across repeats, we relabel
    # contiguous segments by comparing their mean chroma profile.
    seg_starts = list(boundaries)
    if seg_starts[0] != 0:
        seg_starts = [0] + seg_starts
    seg_ends = seg_starts[1:] + [n_beats]

    seg_profiles = []
    for s, e in zip(seg_starts, seg_ends):
        prof = chroma_sync[:, s:e].mean(axis=1)
        prof = prof / (np.linalg.norm(prof) + 1e-9)
        seg_profiles.append(prof)

    # Greedy matching: assign first occurrence of each distinct profile a new
    # letter; subsequent segments with high correlation reuse the letter.
    seg_labels = []
    next_id = 0
    assigned = {}  # canonical profile index -> label id
    for i, prof in enumerate(seg_profiles):
        best_sim = -1.0
        best_id = None
        for j, can_prof in enumerate(assigned):
            sim = float(np.dot(prof, seg_profiles[can_prof]))
            if sim > best_sim:
                best_sim = sim
                best_id = assigned[can_prof]
        # Threshold for considering two sections the same type.
        if best_id is not None and best_sim > 0.85:
            seg_labels.append(best_id)
        else:
            assigned[i] = next_id
            seg_labels.append(next_id)
            next_id += 1

    # ------------------------------------------------------------------
    # 11. Map cluster ids back to time intervals
    # ------------------------------------------------------------------
    beat_times = librosa.frames_to_time(
        beat_frames, sr=sr, hop_length=hop_length
    )

    segments = []
    for s, e, lbl in zip(seg_starts, seg_ends, seg_labels):
        start_t = float(beat_times[s]) if s < len(beat_times) else 0.0
        if e < len(beat_times):
            end_t = float(beat_times[e])
        else:
            end_t = float(duration)
        segments.append(
            {"start": round(start_t, 4), "end": round(end_t, 4),
             "label": chr(ord("A") + lbl)}
        )

    # ------------------------------------------------------------------
    # 12. Post-processing: enforce constraints
    # ------------------------------------------------------------------
    # Sort by start time.
    segments.sort(key=lambda s: s["start"])

    # Ensure first segment starts near 0.
    if segments[0]["start"] > 0.3:
        segments[0]["start"] = 0.0

    # Ensure last segment ends near audio duration.
    if abs(segments[-1]["end"] - duration) > 0.5:
        segments[-1]["end"] = round(duration, 4)

    # Fix any gaps / overlaps between adjacent segments so that no gap > 0.3s
    # and no overlap > 0.05s. We do this by snapping ends to the next start.
    for i in range(len(segments) - 1):
        cur_end = segments[i]["end"]
        nxt_start = segments[i + 1]["start"]
        gap = nxt_start - cur_end
        if gap > 0.3:
            # Close gap by moving current end to next start.
            segments[i]["end"] = round(nxt_start, 4)
        elif gap < -0.05:
            # Overlap: move current end to next start.
            segments[i]["end"] = round(nxt_start, 4)
        # If the gap is small but positive, ensure start < end and minimal.

    # Ensure each segment duration > 0.5s; merge tiny segments into neighbor.
    merged = []
    for seg in segments:
        if merged and (seg["end"] - seg["start"]) <= 0.5:
            # Extend previous segment's end.
            merged[-1]["end"] = seg["end"]
        else:
            merged.append(seg)
    # If first segment is too small, merge forward.
    if len(merged) >= 2 and (merged[0]["end"] - merged[0]["start"]) <= 0.5:
        merged[1]["start"] = merged[0]["start"]
        merged.pop(0)

    segments = merged

    # Final safety: ensure start < end.
    segments = [s for s in segments if s["end"] - s["start"] > 0.5]

    # ------------------------------------------------------------------
    # 13. Write output
    # ------------------------------------------------------------------
    with open("/home/user/segments.json", "w") as f:
        json.dump(segments, f, indent=2)

    # Print a summary.
    print(f"Audio duration: {duration:.2f}s")
    print(f"Beats detected: {n_beats}")
    print(f"Tempo: {float(np.ravel(tempo)[0]):.1f} BPM")
    print(f"Segments ({len(segments)}):")
    for s in segments:
        print(f"  {s['label']}: {s['start']:.2f}s - {s['end']:.2f}s "
              f"(dur {s['end']-s['start']:.2f}s)")


if __name__ == "__main__":
    main()