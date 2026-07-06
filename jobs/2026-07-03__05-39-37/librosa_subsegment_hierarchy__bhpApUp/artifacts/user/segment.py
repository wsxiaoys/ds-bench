#!/usr/bin/env python3
"""Hierarchical music segmentation with librosa 0.11.

Produces a 2-level (coarse / fine) segmentation of a short tonal audio clip:
  - coarse layer: librosa.segment.agglomerative on a beat-synchronous chroma_cqt
  - fine layer:   librosa.segment.subsegment (n_segments=3) refines each coarse
                  section into exactly 3 sub-sections.

Output is written to /home/user/hierarchy.json.
"""

import json
import numpy as np
import librosa

INPUT_WAV = "/home/user/input.wav"
OUTPUT_JSON = "/home/user/hierarchy.json"

HOP_LENGTH = 512
SR = 22050
K_COARSE = 6          # target number of coarse segments (must be in [4, 8])
N_FINE = 3            # fine sub-segments per coarse segment


def choose_k(n_cols, k_target=K_COARSE):
    """Pick a coarse segment count k in [4, 8] such that every agglomerative
    segment can be sub-divided into exactly N_FINE beat-columns.

    We require the average span (n_cols // k) to be >= N_FINE with some margin
    so that subsegment's constrained clustering has at least N_FINE columns to
    work with for each interval.
    """
    k = k_target
    # Make sure k stays within the allowed band and that segments are big enough.
    while k > 4 and (n_cols // k) < (N_FINE + 1):
        k -= 1
    # Clamp into [4, 8]
    k = max(4, min(8, k))
    return k


def main():
    # ------------------------------------------------------------------
    # 1. Load audio
    # ------------------------------------------------------------------
    y, sr = librosa.load(INPUT_WAV, sr=SR, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    # ------------------------------------------------------------------
    # 2. Beat tracking (frames at a consistent hop_length)
    # ------------------------------------------------------------------
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP_LENGTH)
    beats = np.asarray(beats, dtype=int)

    # ------------------------------------------------------------------
    # 3. Chroma CQT (frame-synchronous) then beat-synchronous aggregation
    # ------------------------------------------------------------------
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=HOP_LENGTH)
    n_frames = chroma.shape[1]

    # Pad beat indices to span [0, n_frames]; these padded boundaries map
    # beat-sync *column* indices back to absolute frame indices.
    padded_beats = librosa.util.fix_frames(
        beats, x_min=0, x_max=n_frames, pad=True
    )

    # Beat-synchronous chroma.  Column j aggregates the frames in the interval
    # [padded_beats[j], padded_beats[j+1]); there are len(padded_beats)-1 columns.
    chroma_sync = librosa.util.sync(chroma, beats, aggregate=np.median)
    n_cols = chroma_sync.shape[1]  # == len(padded_beats) - 1

    # ------------------------------------------------------------------
    # 4. Coarse segmentation via agglomerative clustering
    # ------------------------------------------------------------------
    k = choose_k(n_cols)
    # Retry with smaller k if any resulting segment span is < N_FINE columns,
    # because subsegment needs at least N_FINE columns to emit N_FINE children.
    while k >= 4:
        coarse_cols = librosa.segment.agglomerative(chroma_sync, k)
        coarse_cols = np.asarray(coarse_cols, dtype=int)
        spans = np.diff(np.append(coarse_cols, n_cols))
        if spans.min() >= N_FINE:
            break
        k -= 1
    coarse_cols = np.asarray(coarse_cols, dtype=int)
    n_coarse = len(coarse_cols)

    # Map coarse column indices -> absolute frame indices, then -> time.
    # The final right boundary is padded_beats[n_cols] == n_frames.
    coarse_bound_frames = np.append(padded_beats[coarse_cols], n_frames)
    coarse_bound_time = librosa.frames_to_time(
        coarse_bound_frames, sr=sr, hop_length=HOP_LENGTH
    )
    # Clamp the extremes to the true audio duration.
    coarse_bound_time[0] = 0.0
    coarse_bound_time[-1] = duration

    # ------------------------------------------------------------------
    # 5. Fine segmentation: subdivide each coarse section into 3 sub-segments.
    #
    # We call librosa.segment.subsegment once, passing the beat-synchronous
    # chroma matrix and the coarse boundary *column* indices.  subsegment
    # internally pads the boundaries with 0 and n_cols, then runs constrained
    # agglomerative clustering (k=N_FINE) on every coarse interval.  The
    # returned array merges the input boundaries with the new sub-boundaries:
    # each coarse interval contributes exactly N_FINE left-boundary column
    # indices (its own start plus N_FINE-1 internal ones), so the merged array
    # has N_FINE * n_coarse entries in order.
    # ------------------------------------------------------------------
    sub_cols = librosa.segment.subsegment(
        chroma_sync, coarse_cols, n_segments=N_FINE
    )
    sub_cols = np.asarray(sub_cols, dtype=int)

    # Safety: if some interval produced fewer than N_FINE boundaries (only
    # possible when a span < N_FINE, which we guarded against), fall back to a
    # per-segment slice approach so we always emit exactly N_FINE children.
    if len(sub_cols) != N_FINE * n_coarse:
        sub_cols = _subsegment_per_segment(chroma_sync, coarse_cols, n_cols, N_FINE)

    # ------------------------------------------------------------------
    # 6. Build the coarse layer
    # ------------------------------------------------------------------
    coarse = []
    for i in range(n_coarse):
        start = float(coarse_bound_time[i])
        end = float(coarse_bound_time[i + 1])
        coarse.append({"index": i, "start": start, "end": end})

    # ------------------------------------------------------------------
    # 7. Build the fine layer with parent linkage
    # ------------------------------------------------------------------
    fine = []
    fine_index = 0
    for i in range(n_coarse):
        # The N_FINE left-boundary column indices for coarse section i occupy
        # positions [N_FINE*i, N_FINE*i + N_FINE) in the merged array.
        seg_cols = sub_cols[N_FINE * i: N_FINE * i + N_FINE]
        # Append the closing boundary: next coarse start column, or n_cols.
        if i + 1 < n_coarse:
            close_col = coarse_cols[i + 1]
        else:
            close_col = n_cols
        bound_cols = np.append(seg_cols, close_col)
        bound_frames = padded_beats[bound_cols]
        bound_time = librosa.frames_to_time(
            bound_frames, sr=sr, hop_length=HOP_LENGTH
        )
        # Clamp to the parent coarse section extents so children fully cover it.
        bound_time[0] = coarse[i]["start"]
        bound_time[-1] = coarse[i]["end"]

        for j in range(N_FINE):
            fine.append({
                "index": fine_index,
                "start": float(bound_time[j]),
                "end": float(bound_time[j + 1]),
                "parent_index": i,
            })
            fine_index += 1

    # ------------------------------------------------------------------
    # 8. Write JSON
    # ------------------------------------------------------------------
    out = {"coarse": coarse, "fine": fine}
    with open(OUTPUT_JSON, "w") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {OUTPUT_JSON}")
    print(f"  coarse segments: {n_coarse} (k={k})")
    print(f"  fine segments:   {len(fine)} (3 per coarse)")
    print(f"  audio duration:  {duration:.3f} s")


def _subsegment_per_segment(chroma_sync, coarse_cols, n_cols, n_fine):
    """Fallback: subdivide each coarse interval individually using a slice of
    the beat-synchronous chroma, guaranteeing exactly n_fine children per
    coarse section even when a section is short.
    """
    merged = []
    for i in range(len(coarse_cols)):
        c_start = int(coarse_cols[i])
        c_end = int(coarse_cols[i + 1]) if i + 1 < len(coarse_cols) else n_cols
        span = c_end - c_start
        slice_ = chroma_sync[:, c_start:c_end]
        if span >= n_fine:
            sub = librosa.segment.subsegment(
                slice_, np.array([0, span]), n_segments=n_fine
            )
            sub = np.asarray(sub, dtype=int)
        else:
            # Fewer columns than n_fine: split the available columns as evenly
            # as possible, then duplicate the last boundary so we still emit
            # exactly n_fine (degenerate but non-overlapping) sub-segments.
            base = np.linspace(0, span, num=span, endpoint=False).astype(int)
            sub = np.concatenate([base, np.full(n_fine - len(base), span)])
        merged.extend((c_start + sub).tolist())
    return np.asarray(merged, dtype=int)


if __name__ == "__main__":
    main()