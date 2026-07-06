#!/usr/bin/env python3
"""Validate /home/user/peaks.json against the required schema & constraints."""
import json
import math
import numpy as np
import librosa

PATH = "/home/user/peaks.json"
INPUT = "/home/user/input.wav"

with open(PATH) as f:
    data = json.load(f)

errors = []

# meta
meta = data["meta"]
for k in ["n_frames", "sr", "n_fft", "hop_length"]:
    if k not in meta:
        errors.append(f"meta missing {k}")

frames = data["frames"]
n_frames = len(frames)

# Recompute ground truth from librosa
y, sr = librosa.load(INPUT, sr=None)
freqs, times, mags = librosa.reassigned_spectrogram(
    y=y, sr=sr, n_fft=meta["n_fft"], hop_length=meta["hop_length"], center=True
)
gt_nframes = freqs.shape[1]
dur = len(y) / sr

print("meta:", meta)
print(f"ground truth frames={gt_nframes}, sr={sr}, dur={dur}")

if meta["n_frames"] != n_frames:
    errors.append(f"meta.n_frames ({meta['n_frames']}) != len(frames) ({n_frames})")
if meta["n_frames"] != gt_nframes:
    errors.append(f"meta.n_frames ({meta['n_frames']}) != librosa frames ({gt_nframes})")
if meta["sr"] != sr:
    errors.append(f"meta.sr ({meta['sr']}) != input sr ({sr})")

prev_time = -float("inf")
for i, fr in enumerate(frames):
    if "time" not in fr:
        errors.append(f"frame {i} missing time"); continue
    t = fr["time"]
    if not isinstance(t, (int, float)) or not math.isfinite(t):
        errors.append(f"frame {i} time not finite: {t}")
    if t < prev_time:
        errors.append(f"frame {i} time {t} < prev {prev_time} (not monotonic)")
    prev_time = t
    if not (0.0 <= t <= dur + 1e-2):
        errors.append(f"frame {i} time {t} out of [0, {dur+1e-2}]")

    peaks = fr["peaks"]
    if len(peaks) != 5:
        errors.append(f"frame {i} has {len(peaks)} peaks (expected 5)")
    # check descending order
    dbs = [p["magnitude_db"] for p in peaks]
    if dbs != sorted(dbs, reverse=True):
        errors.append(f"frame {i} peaks not sorted descending: {dbs}")
    for j, p in enumerate(peaks):
        if set(p.keys()) != {"freq_hz", "magnitude_db"}:
            errors.append(f"frame {i} peak {j} keys {set(p.keys())}")
        f = p["freq_hz"]; m = p["magnitude_db"]
        if not math.isfinite(f):
            errors.append(f"frame {i} peak {j} freq not finite: {f}")
        if not math.isfinite(m):
            errors.append(f"frame {i} peak {j} mag not finite: {m}")
        if not (0.0 < f <= sr / 2.0):
            errors.append(f"frame {i} peak {j} freq {f} not in (0, {sr/2}]")

# last frame within 0.1s of duration
last_time = frames[-1]["time"]
if abs(dur - last_time) > 0.1:
    errors.append(f"last frame time {last_time} not within 0.1s of dur {dur}")

print(f"\nframes: {n_frames}")
print(f"first time: {frames[0]['time']}, last time: {frames[-1]['time']}")
print(f"sample first frame peaks[0]: {frames[0]['peaks'][0]}")
print(f"sample last frame peaks[0]: {frames[-1]['peaks'][0]}")

if errors:
    print("\nVALIDATION FAILED:")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)
print("\nALL VALIDATION CHECKS PASSED ✓")