"""
Percussive Onset Grid Quantizer with HPSS, Beat Tracking, and Velocity Estimation.

Pipeline:
  1. Load mono WAV.
  2. HPSS to isolate the percussive waveform.
  3. Onset strength envelope + peak picking on the percussive signal.
  4. Global tempo via beat tracking on the percussive signal.
  5. 16th-note grid: spacing = 60 / tempo / 4 seconds, starting at time 0.
  6. Snap each onset to the nearest 16th-note grid position inside the duration.
  7. Per-hit velocity from the local onset envelope amplitude, normalized to (0.0, 1.0].
  8. Write a chronologically ordered JSON file.
"""
import json
import numpy as np
import librosa

INPUT_PATH = "/home/user/input.wav"
OUTPUT_PATH = "/home/user/hits.json"

# A single hop_length used for the onset envelope, peak picking, beat tracking,
# and frame-to-time conversion so frame indices and times stay consistent.
HOP_LENGTH = 512


def main() -> None:
    # 1. Load the audio file at its native sample rate.
    y, sr = librosa.load(path=INPUT_PATH, sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    # 2. Separate the percussive waveform via HPSS.
    #    librosa >= 0.11 returns a (harmonic, percussive) tuple; older versions
    #    returned only the percussive component. Handle both.
    _hpss_result = librosa.effects.hpss(y=y)
    if isinstance(_hpss_result, tuple):
        y_harm, y_perc = _hpss_result
    else:
        y_perc = _hpss_result

    # 3. Onset strength envelope on the percussive signal.
    onset_env = librosa.onset.onset_strength(
        y=y_perc, sr=sr, hop_length=HOP_LENGTH
    )

    # 4. Peak picking on the envelope. Use modest thresholds so we get
    #    well-separated 16th-note hits for a ~12s drum loop at ~120 BPM.
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=HOP_LENGTH,
        units="frames",
        pre_max=3,
        post_max=3,
        pre_avg=3,
        post_avg=3,
        delta=0.1,
        wait=2,
    )

    # 5. Convert detected onset frames to seconds.
    onset_times = librosa.frames_to_time(
        frames=onset_frames, sr=sr, hop_length=HOP_LENGTH
    )

    # 6. Recover the global tempo via beat tracking on the percussive signal.
    tempo_raw, _beat_frames = librosa.beat.beat_track(
        y=y_perc, sr=sr, hop_length=HOP_LENGTH, units="frames"
    )
    # beat_track may return a scalar or a 1-element array; normalize to float.
    tempo = float(np.atleast_1d(tempo_raw)[0])

    # 7. Build the 16th-note grid. Spacing = 60 / tempo / 4 seconds, starting at 0.
    step = 60.0 / tempo / 4.0  # seconds per 16th note

    # 8. Snap each onset to the nearest grid position.
    grid_indices = np.rint(onset_times / step).astype(int)
    snapped_times = grid_indices.astype(float) * step

    # 9. Keep only hits whose snapped time lies within the audio duration.
    in_bounds = (snapped_times >= 0.0) & (snapped_times < duration)
    grid_indices = grid_indices[in_bounds]
    snapped_times = snapped_times[in_bounds]
    raw_times = onset_times[in_bounds]
    onset_frames_valid = onset_frames[in_bounds]

    # 10. Per-hit velocity from the onset envelope at each detected onset frame.
    amplitudes = onset_env[onset_frames_valid].astype(float)
    max_amp = float(amplitudes.max()) if amplitudes.size else 0.0
    if max_amp > 0.0:
        velocities = amplitudes / max_amp
        # Guarantee strictly positive minimum while keeping max == 1.0.
        min_vel = float(velocities.min())
        if min_vel <= 0.0:
            eps = 1e-3
            velocities = (velocities - min_vel) / (1.0 - min_vel)
            velocities = velocities * (1.0 - eps) + eps
    else:
        velocities = np.ones_like(amplitudes)

    # 11. Order chronologically by snapped time.
    order = np.argsort(snapped_times, kind="mergesort")
    snapped_times = snapped_times[order]
    grid_indices = grid_indices[order]
    raw_times = raw_times[order]
    velocities = velocities[order]

    # 12. Assemble the hit records.
    hits = []
    for st, gi, rt, v in zip(snapped_times, grid_indices, raw_times, velocities):
        hits.append(
            {
                "time_seconds": float(st),
                "grid_index": int(gi),
                "velocity": float(v),
                "raw_time_seconds": float(rt),
            }
        )

    # 13. Write the output. Include the optional metadata block so the
    #     verifier can skip its own tempo recomputation.
    output = {
        "hits": hits,
        "_metadata": {
            "estimated_tempo": float(tempo),
        },
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(hits)} hits to {OUTPUT_PATH}")
    print(f"  tempo = {tempo:.4f} BPM")
    print(f"  16th-note step = {step:.6f} s")
    print(f"  duration = {duration:.4f} s")
    print(f"  hop_length = {HOP_LENGTH}")
    print(f"  raw onset frames detected = {len(onset_frames)}")
    print(f"  in-bounds hits = {len(hits)}")
    if hits:
        print(
            f"  velocity range = [{min(h['velocity'] for h in hits):.6f}, "
            f"{max(h['velocity'] for h in hits):.6f}]"
        )


if __name__ == "__main__":
    main()
