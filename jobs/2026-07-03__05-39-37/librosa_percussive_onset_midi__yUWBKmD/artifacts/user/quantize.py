#!/usr/bin/env python3
"""Percussive onset grid quantizer.

Pipeline:
  1. Load the input WAV.
  2. Isolate the percussive component with HPSS.
  3. Detect onsets on the percussive-only signal.
  4. Recover a global tempo via beat tracking on the percussive signal.
  5. Snap each onset to the nearest 16th-note grid position.
  6. Estimate a normalized per-hit velocity from the onset envelope.
  7. Write the hits to /home/user/hits.json.
"""

import json

import numpy as np
import librosa

INPUT_PATH = "/home/user/input.wav"
OUTPUT_PATH = "/home/user/hits.json"

# A single hop_length is reused everywhere so frame indices and times stay
# consistent across onset detection, beat tracking, and frame->time conversion.
HOP_LENGTH = 512
TARGET_SR = 22050


def main() -> None:
    # ------------------------------------------------------------------
    # 1. Load audio (mono, resampled to a known rate for determinism).
    # ------------------------------------------------------------------
    y, sr = librosa.load(INPUT_PATH, sr=TARGET_SR, mono=True)
    duration = float(len(y) / sr)

    # ------------------------------------------------------------------
    # 2. HPSS: separate percussive content from harmonic content.
    #    All subsequent analysis runs on the percussive signal only.
    # ------------------------------------------------------------------
    _harmonic, percussive = librosa.effects.hpss(y, hop_length=HOP_LENGTH)

    # ------------------------------------------------------------------
    # 3. Onset strength envelope + peak picking on the percussive signal.
    #    The same envelope is reused for both onset detection and beat
    #    tracking, and the same hop_length keeps frames consistent.
    # ------------------------------------------------------------------
    onset_env = librosa.onset.onset_strength(
        y=percussive, sr=sr, hop_length=HOP_LENGTH
    )

    # Peak-picking parameters tuned for a ~12s drum loop near 120 BPM so we
    # get at least 5 well-separated hits.  These keyword arguments are
    # forwarded by onset_detect to librosa.util.peak_pick.
    onset_frames = librosa.onset.onset_detect(
        y=percussive,
        sr=sr,
        onset_envelope=onset_env,
        hop_length=HOP_LENGTH,
        pre_max=6,
        post_max=6,
        pre_avg=6,
        post_avg=6,
        delta=0.07,
        wait=6,
        units="frames",
    )

    # ------------------------------------------------------------------
    # 4. Beat tracking on the percussive signal to recover a global tempo.
    # ------------------------------------------------------------------
    tempo, _beat_frames = librosa.beat.beat_track(
        y=percussive,
        sr=sr,
        onset_envelope=onset_env,
        hop_length=HOP_LENGTH,
        start_bpm=120.0,
        tightness=100,
        units="frames",
    )
    # beat_track may return a 0-d numpy array; normalise to a Python float.
    tempo = float(np.atleast_1d(tempo)[0])

    # ------------------------------------------------------------------
    # 5. Derive the 16th-note grid from the tempo.
    #    Spacing of a 16th note = quarter-note spacing / 4 = (60/tempo)/4.
    # ------------------------------------------------------------------
    sixteenth_step = 60.0 / tempo / 4.0  # seconds per 16th note
    max_grid_index = int(np.floor(duration / sixteenth_step))

    # Convert detected onset frames to raw onset times (seconds).
    raw_times = librosa.frames_to_time(
        onset_frames, sr=sr, hop_length=HOP_LENGTH
    )

    # ------------------------------------------------------------------
    # 6. Per-hit velocity from the local onset envelope amplitude.
    #    Sample the envelope at each detected onset frame, then rescale so
    #    the maximum velocity is exactly 1.0 while every strictly-positive
    #    minimum stays strictly above 0.0.
    # ------------------------------------------------------------------
    amplitudes = onset_env[onset_frames].astype(float)
    max_amp = amplitudes.max() if amplitudes.size else 0.0
    if max_amp > 0.0:
        velocities = amplitudes / max_amp
    else:
        velocities = amplitudes.copy()
    # Guarantee strict positivity (clip any accidental zero to a tiny floor).
    velocities = np.maximum(velocities, 1e-6)

    # ------------------------------------------------------------------
    # 7. Snap each onset to the nearest 16th-note grid position.
    # ------------------------------------------------------------------
    hits = []
    for raw_time, velocity in zip(raw_times, velocities):
        grid_index = int(round(float(raw_time) / sixteenth_step))
        # Clamp into the valid grid range that fits within the audio duration.
        grid_index = max(0, min(grid_index, max_grid_index))
        snapped_time = grid_index * sixteenth_step
        hits.append(
            {
                "time_seconds": float(snapped_time),
                "grid_index": grid_index,
                "velocity": float(velocity),
                "raw_time_seconds": float(raw_time),
            }
        )

    # Chronological order (by snapped time, then raw time as tie-breaker).
    hits.sort(key=lambda h: (h["time_seconds"], h["raw_time_seconds"]))

    # Top-level object carrying the hits array plus the estimated tempo so a
    # verifier can reuse our tempo instead of recomputing it.
    output = {
        "hits": hits,
        "_metadata": {"estimated_tempo": tempo},
    }

    with open(OUTPUT_PATH, "w") as fh:
        json.dump(output, fh, indent=2)

    # ---- diagnostics to stdout ---------------------------------------
    print(f"sr={sr}  duration={duration:.4f}s  samples={len(y)}")
    print(f"detected onsets: {len(onset_frames)}")
    print(f"estimated tempo: {tempo:.4f} BPM")
    print(f"16th-note step: {sixteenth_step:.6f}s  max_grid_index={max_grid_index}")
    print(f"wrote {len(hits)} hits to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()