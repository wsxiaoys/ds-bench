#!/usr/bin/env python3
"""Monophonic onset-based MIDI note transcriber.

Reads a short audio file, detects note onsets, estimates per-note pitch with
pyin, quantizes to a MIDI integer, derives a velocity from per-note RMS
energy, and writes the result to a JSON file.
"""

import json

import numpy as np
import librosa


INPUT_WAV = "/home/user/input.wav"
OUTPUT_JSON = "/home/user/notes.json"

# pyin pitch search range (Hz) -- wide enough to capture typical monophonic
# synthesized notes from a low bass up to a high treble.
FMIN = librosa.note_to_hz("C1")  # ~32.7 Hz
FMAX = librosa.note_to_hz("C7")  # ~2093 Hz


def median_voiced_f0(segment, sr):
    """Return the median voiced f0 (Hz) for a segment, or None if unvoiced."""
    f0, voiced_flag, _ = librosa.pyin(
        segment, fmin=FMIN, fmax=FMAX, sr=sr
    )
    voiced = f0[voiced_flag]
    if voiced.size == 0:
        # fall back to non-NaN frames if voiced_flag is all False
        voiced = f0[~np.isnan(f0)]
    if voiced.size == 0:
        return None
    return float(np.median(voiced))


def rms_energy(segment):
    """Root-mean-square energy of a segment."""
    if segment.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(segment ** 2)))


def main():
    y, sr = librosa.load(INPUT_WAV, sr=None)
    duration = len(y) / sr

    # Onset detection with backtracking to local energy minimum.
    onset_times = librosa.onset.onset_detect(
        y=y, sr=sr, backtrack=True, units="time"
    )
    onset_samples = librosa.time_to_samples(onset_times, sr=sr)

    # Append the end of the audio so the final note has an offset boundary.
    onset_samples = np.append(onset_samples, len(y))
    onset_times = np.append(onset_times, duration)

    raw_notes = []
    for i in range(len(onset_samples) - 1):
        start_s = onset_samples[i]
        end_s = onset_samples[i + 1]
        segment = y[start_s:end_s]
        if segment.size == 0:
            continue

        onset_sec = float(onset_times[i])
        offset_sec = float(onset_times[i + 1])

        # Ensure strictly increasing bounds.
        if offset_sec <= onset_sec:
            offset_sec = onset_sec + (1.0 / sr)

        f0 = median_voiced_f0(segment, sr)
        if f0 is None or not np.isfinite(f0) or f0 <= 0:
            # No reliable pitch -> skip this detection.
            continue

        pitch_midi = int(round(librosa.hz_to_midi(f0)))
        pitch_midi = int(np.clip(pitch_midi, 0, 127))

        raw_notes.append(
            {
                "onset_sec": onset_sec,
                "offset_sec": offset_sec,
                "pitch_midi": pitch_midi,
                "rms": rms_energy(segment),
            }
        )

    if not raw_notes:
        with open(OUTPUT_JSON, "w") as fh:
            json.dump([], fh, indent=2)
        return

    # Derive velocities proportional to per-note RMS energy via min-max
    # normalization into [1, 127].
    rms_values = np.array([n["rms"] for n in raw_notes], dtype=float)
    rms_min = rms_values.min()
    rms_max = rms_values.max()
    if rms_max - rms_min > 1e-12:
        norm = (rms_values - rms_min) / (rms_max - rms_min)
        velocities = np.round(1 + 126 * norm)
    else:
        velocities = np.full(len(raw_notes), 100.0)
    velocities = np.clip(velocities, 1, 127).astype(int)

    notes = []
    for n, vel in zip(raw_notes, velocities):
        notes.append(
            {
                "onset_sec": n["onset_sec"],
                "offset_sec": n["offset_sec"],
                "pitch_midi": n["pitch_midi"],
                "velocity": int(vel),
            }
        )

    # Sort strictly by onset time.
    notes.sort(key=lambda x: x["onset_sec"])

    # Enforce offset constraint: no greater than duration + 0.1 s.
    max_offset = duration + 0.1
    for n in notes:
        if n["offset_sec"] > max_offset:
            n["offset_sec"] = max_offset
        if n["offset_sec"] <= n["onset_sec"]:
            n["offset_sec"] = min(max_offset, n["onset_sec"] + 1.0 / sr)

    with open(OUTPUT_JSON, "w") as fh:
        json.dump(notes, fh, indent=2)

    print(f"Wrote {len(notes)} notes to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()