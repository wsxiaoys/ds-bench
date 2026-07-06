"""Major/minor chord recognition pipeline.

Loads /home/user/input.wav, computes a CQT-based chromagram, scores each frame
against 24 major/minor triad templates, runs Viterbi decoding over the
24-state space with a self-biased transition matrix, and writes time-aligned
chord segments to /home/user/chords.json.
"""

from __future__ import annotations

import json
from pathlib import Path

import librosa
import numpy as np


INPUT_PATH = Path("/home/user/input.wav")
OUTPUT_PATH = Path("/home/user/chords.json")

# 24 chord labels: 12 major + 12 minor, in standard pitch-class order.
PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F",
                 "F#", "G", "G#", "A", "A#", "B"]
CHORD_LABELS = [f"{pc}:maj" for pc in PITCH_CLASSES] + \
               [f"{pc}:min" for pc in PITCH_CLASSES]
N_STATES = len(CHORD_LABELS)
assert N_STATES == 24

# Major triad intervals: root, major-3rd (4 semitones), perfect-5th (7 semitones).
MAJOR_INTERVALS = np.array([0, 4, 7])
MINOR_INTERVALS = np.array([0, 3, 7])

# Self-transition probability for the HMM-style transition matrix.
SELF_PROB = 0.9

# Frame-rate configuration used for both chroma and frames_to_time.
HOP_LENGTH = 512
SR = 22050


def build_chord_templates() -> np.ndarray:
    """Return a (24, 12) matrix of unit-norm binary chord templates."""
    templates = np.zeros((N_STATES, 12), dtype=np.float64)
    for i, pc in enumerate(PITCH_CLASSES):
        templates[i, (pc_to_index(pc) + MAJOR_INTERVALS) % 12] = 1.0
        templates[i + 12, (pc_to_index(pc) + MINOR_INTERVALS) % 12] = 1.0
    # Normalise each template to unit L2 norm so dot products are bounded.
    norms = np.linalg.norm(templates, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return templates / norms


def pc_to_index(pc: str) -> int:
    """Map a pitch-class name (e.g. 'C#') to its 0-11 index."""
    return PITCH_CLASSES.index(pc)


def build_transition_matrix() -> np.ndarray:
    """24x24 row-stochastic matrix favouring self-transitions."""
    trans = np.full((N_STATES, N_STATES),
                    (1.0 - SELF_PROB) / (N_STATES - 1),
                    dtype=np.float64)
    np.fill_diagonal(trans, SELF_PROB)
    return trans


def compute_observation_likelihoods(chroma: np.ndarray,
                                     templates: np.ndarray) -> np.ndarray:
    """Return a (24, n_frames) non-negative likelihood matrix.

    Each column is renormalised so it sums to 1, ensuring non-negativity and
    keeping the values on a comparable scale across frames.
    """
    scores = templates @ chroma  # (24, n_frames)
    # Sharpen and normalise per-frame to turn scores into a probability-like
    # distribution that the Viterbi routine can consume.
    scores = np.maximum(scores, 0.0)
    col_sums = scores.sum(axis=0, keepdims=True)
    col_sums[col_sums == 0] = 1.0
    return scores / col_sums


def frame_starts(n_frames: int) -> np.ndarray:
    """Return start-time (in seconds) of every chroma frame."""
    return librosa.frames_to_time(
        np.arange(n_frames), sr=SR, hop_length=HOP_LENGTH
    )


def merge_segments(state_seq: np.ndarray,
                   times: np.ndarray,
                   duration: float,
                   hop_seconds: float,
                   min_duration: float = 0.1) -> list[dict]:
    """Collapse consecutive frames that share a state into time-aligned segments.

    Each merged segment is clipped to the audio duration so that the last
    segment ends exactly at ``duration`` without overlap or gaps. Any segment
    whose duration is shorter than ``min_duration`` seconds is absorbed into
    an adjacent (preferring the previous) segment to satisfy the minimum
    duration requirement.
    """
    segments: list[dict] = []
    if len(state_seq) == 0:
        return segments

    current_state = int(state_seq[0])
    seg_start = float(times[0])

    for idx in range(1, len(state_seq)):
        state = int(state_seq[idx])
        if state != current_state:
            seg_end = float(times[idx])
            segments.append({
                "start": float(seg_start),
                "end": float(seg_end),
                "chord": CHORD_LABELS[current_state],
            })
            current_state = state
            seg_start = seg_end

    # Close out the final segment. The end should match the time of the frame
    # that follows the last observed frame (so that segments tile continuously
    # across the whole track). If that falls outside the audio, clamp to the
    # audio duration. ``len(times)`` is the number of chroma frames, so the
    # natural end of the last frame is at index ``len(times)``.
    final_end = float(librosa.frames_to_time(
        np.array([len(times)]), sr=SR, hop_length=HOP_LENGTH
    )[0])
    final_end = min(final_end, duration)
    segments.append({
        "start": float(seg_start),
        "end": float(final_end),
        "chord": CHORD_LABELS[current_state],
    })

    # Clamp every segment end to duration as a safety net.
    for seg in segments:
        seg["end"] = min(seg["end"], duration)

    # Absorb segments that are shorter than ``min_duration`` into an adjacent
    # neighbour. Prefer the previous segment so that the timeline stays in
    # chronological order; fall back to the next segment for the very first
    # short segment. This loop iterates because removing one segment can cause
    # the new neighbour to become too short.
    changed = True
    while changed and len(segments) > 1:
        changed = False
        for i, seg in enumerate(segments):
            if (seg["end"] - seg["start"]) > min_duration:
                continue
            if i > 0:
                segments[i - 1]["end"] = seg["end"]
                segments[i - 1]["chord"] = seg["chord"]
            else:
                # Merge forward into the next segment.
                segments[i + 1]["start"] = seg["start"]
                segments[i + 1]["chord"] = seg["chord"]
            del segments[i]
            changed = True
            break
    return segments


def main() -> None:
    # 1. Load audio (mono, preserve native sample rate).
    y, sr = librosa.load(INPUT_PATH, sr=SR, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Loaded audio: sr={sr}, duration={duration:.3f}s, samples={len(y)}")

    # 2. CQT chromagram (better for tonal content than STFT chroma).
    chroma = librosa.feature.chroma_cqt(
        y=y, sr=sr, hop_length=HOP_LENGTH
    )
    n_frames = chroma.shape[1]
    print(f"Chroma shape: {chroma.shape}")

    # 3. Build templates and observation likelihoods.
    templates = build_chord_templates()
    prob = compute_observation_likelihoods(chroma, templates)
    print(f"Observation likelihood shape: {prob.shape}")

    # 4. Transition matrix with self-bias.
    trans = build_transition_matrix()
    assert np.allclose(trans.sum(axis=1), 1.0), "Transition rows must sum to 1"

    # 5. Viterbi decoding (keyword-only API in librosa 0.11.0).
    states = librosa.sequence.viterbi(prob=prob, transition=trans)
    states = np.asarray(states).reshape(-1)

    # 6. Map frame indices to start times and merge into segments.
    times = frame_starts(n_frames)
    hop_seconds = HOP_LENGTH / sr
    segments = merge_segments(states, times, duration, hop_seconds)

    # 7. Sanity checks before writing.
    distinct_labels = {seg["chord"] for seg in segments}
    assert len(distinct_labels) >= 2, "Need at least 2 distinct chord labels"
    assert segments[0]["start"] < segments[0]["end"], "First segment invalid"
    for seg in segments:
        assert seg["start"] < seg["end"], f"Bad segment: {seg}"
        assert (seg["end"] - seg["start"]) > 0.1, f"Segment too short: {seg}"
    # Continuous coverage from ~0 to audio duration, no gaps or overlaps.
    assert segments[-1]["end"] >= duration - 1e-6, "Last segment must reach end"
    for prev, curr in zip(segments, segments[1:]):
        gap = curr["start"] - prev["end"]
        assert abs(gap) < 1e-6, f"Gap/overlap between segments: {gap}"

    # 8. Write JSON output.
    OUTPUT_PATH.write_text(json.dumps(segments, indent=2))
    print(f"Wrote {len(segments)} segments covering {duration:.2f}s "
          f"to {OUTPUT_PATH}")
    print(f"Distinct chords detected: {sorted(distinct_labels)}")


if __name__ == "__main__":
    main()