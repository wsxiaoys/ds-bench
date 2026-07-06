"""Major/minor chord recognition with chroma features + Viterbi decoding."""

import json
import numpy as np
import librosa

INPUT_WAV = "/home/user/input.wav"
OUTPUT_JSON = "/home/user/chords.json"

# 24 chord labels: 12 major + 12 minor
PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
LABELS = [f"{p}:maj" for p in PITCH_CLASSES] + [f"{p}:min" for p in PITCH_CLASSES]
N_STATES = len(LABELS)  # 24

# Triad templates (pitch-class intervals from the root)
MAJOR_TEMPLATE = np.array([1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], dtype=float)  # root, M3, P5
MINOR_TEMPLATE = np.array([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], dtype=float)  # root, m3, P5


def build_templates():
    """Build the (24, 12) binary chord-template matrix."""
    templates = np.zeros((N_STATES, 12), dtype=float)
    for i in range(12):
        templates[i] = np.roll(MAJOR_TEMPLATE, i)
        templates[12 + i] = np.roll(MINOR_TEMPLATE, i)
    return templates


def build_transition_matrix(stay_prob=0.9):
    """Build a 24x24 row-stochastic transition matrix biased toward self-transitions."""
    T = np.full((N_STATES, N_STATES), (1.0 - stay_prob) / (N_STATES - 1), dtype=float)
    np.fill_diagonal(T, stay_prob)
    # Each row already sums to 1; renormalize defensively.
    T = T / T.sum(axis=1, keepdims=True)
    return T


def main():
    y, sr = librosa.load(INPUT_WAV, sr=None, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    hop_length = 512
    # Chroma from CQT — tonal-content appropriate.
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length, n_chroma=12)
    # chroma shape: (12, n_frames); normalize columns to unit L2 norm for robust matching.
    norms = np.linalg.norm(chroma, axis=0, keepdims=True)
    norms[norms == 0] = 1.0
    chroma = chroma / norms

    templates = build_templates()  # (24, 12)
    # Per-frame, per-state likelihood via dot product (non-negative similarity).
    # obs shape: (24, n_frames)
    obs = templates @ chroma
    obs = np.clip(obs, 1e-6, None)

    # Normalize each frame's likelihood to a proper probability distribution (column-stochastic).
    col_sums = obs.sum(axis=0, keepdims=True)
    col_sums[col_sums == 0] = 1.0
    prob = obs / col_sums

    transition = build_transition_matrix(stay_prob=0.9)
    p_init = np.ones(N_STATES) / N_STATES

    # Viterbi decode: returns state index per frame.
    states = librosa.sequence.viterbi(prob, transition, p_init=p_init)

    times = librosa.frames_to_time(np.arange(len(states)), sr=sr, hop_length=hop_length)

    # Merge consecutive frames with the same chord into segments.
    segments = []
    if len(states) == 0:
        with open(OUTPUT_JSON, "w") as f:
            json.dump([], f)
        return

    seg_start = times[0]
    seg_label = LABELS[int(states[0])]
    for i in range(1, len(states)):
        if int(states[i]) != int(states[i - 1]):
            seg_end = times[i]
            segments.append((seg_start, seg_end, seg_label))
            seg_start = times[i]
            seg_label = LABELS[int(states[i])]
    # Final segment end clamped to audio duration.
    final_end = float(duration)
    segments.append((seg_start, final_end, seg_label))

    # Enforce minimum segment duration (>0.1s) by merging too-short segments
    # into their neighbors.
    cleaned = []
    for start, end, chord in segments:
        if end - start <= 0.1 and cleaned:
            # Extend the previous segment to swallow this short one.
            ps, pe, pc = cleaned[-1]
            cleaned[-1] = (ps, end, pc)
        else:
            cleaned.append((start, end, chord))

    # Final pass: if extending caused adjacent segments to share a label, merge them.
    merged = []
    for start, end, chord in cleaned:
        if merged and merged[-1][2] == chord:
            ps, pe, pc = merged[-1]
            merged[-1] = (ps, end, pc)
        else:
            merged.append((start, end, chord))

    # Ensure strict ordering and start < end, clamp to [0, duration].
    result = []
    for start, end, chord in merged:
        start = max(0.0, float(start))
        end = min(float(duration), float(end))
        if end - start > 0.1:
            result.append({"start": start, "end": end, "chord": chord})

    result.sort(key=lambda x: x["start"])

    with open(OUTPUT_JSON, "w") as f:
        json.dump(result, f, indent=2)

    distinct = len({seg["chord"] for seg in result})
    print(f"Wrote {len(result)} segments, {distinct} distinct chords to {OUTPUT_JSON}")
    for seg in result:
        print(f"  {seg['start']:.3f} - {seg['end']:.3f}  {seg['chord']}")


if __name__ == "__main__":
    main()