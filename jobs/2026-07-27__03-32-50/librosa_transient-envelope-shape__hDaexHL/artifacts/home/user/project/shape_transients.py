#!/usr/bin/env python3
"""
Transient Detection & Envelope Shaper
======================================

A command-line "transient designer" that independently rescales the attack
(transient) portion and the sustain (decay/body) portion of percussive
audio material.

Pipeline:
  1. Read a mono WAV file.
  2. Detect percussive transients (onsets) with librosa, backtracking each
     detected onset to the preceding local minimum of the onset-strength
     envelope so the marker sits at the true start of the hit.
  3. Build a per-sample linear-amplitude gain envelope that is
     `attack_gain_db` inside each attack region and `sustain_gain_db`
     everywhere else, with click-free raised-cosine crossfades of width
     `crossfade_ms` (per side) centered on every region boundary.
  4. Multiply the input waveform by the envelope, clip to [-1, 1] as a
     safety net, and write the shaped WAV (same length & sample rate as
     the input).
  5. Write a JSON report describing the detected transients and gains.

No network access is used; everything runs offline/headless.
"""

import argparse
import json
import sys

import numpy as np
import librosa
import soundfile as sf


def db_to_linear(db: float) -> float:
    """Convert a decibel value to a linear amplitude multiplier."""
    return 10.0 ** (db / 20.0)


def detect_transients(y: np.ndarray, sr: int) -> np.ndarray:
    """Detect onsets and backtrack each to the preceding local minimum of
    the onset-strength envelope. Returns a sorted, de-duplicated array of
    sample indices (int) marking the true start of each transient."""
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr, backtrack=True, units="frames"
    )
    onset_samples = librosa.frames_to_samples(onset_frames)
    onset_samples = np.unique(onset_samples.astype(np.int64))
    onset_samples = onset_samples[(onset_samples >= 0) & (onset_samples < len(y))]
    onset_samples.sort()
    return onset_samples


def build_gain_envelope(
    n_samples: int,
    sr: int,
    onset_samples: np.ndarray,
    attack_lin: float,
    sustain_lin: float,
    attack_ms: float,
    crossfade_ms: float,
) -> np.ndarray:
    """Build the click-free, per-sample linear gain envelope."""
    attack_len = int(round(attack_ms / 1000.0 * sr))
    cw = int(round(crossfade_ms / 1000.0 * sr))

    # 1. Ideal (unsmoothed) piecewise-constant target envelope.
    target = np.full(n_samples, sustain_lin, dtype=np.float64)
    n_onsets = len(onset_samples)
    for i, s in enumerate(onset_samples):
        s = int(s)
        next_s = int(onset_samples[i + 1]) if i + 1 < n_onsets else n_samples
        end = min(s + attack_len, next_s, n_samples)
        if end > s:
            target[s:end] = attack_lin

    envelope = target.copy()

    if n_samples < 2 or cw <= 0:
        return envelope

    # 2. Find every region boundary (sample index where the ideal target
    #    value changes) and smooth it with a raised-cosine crossfade of
    #    total width 2*cw, centered on the boundary.
    diffs = np.diff(target)
    boundary_indices = np.nonzero(diffs)[0] + 1  # boundary occurs at index b

    for b in boundary_indices:
        L = target[b - 1]
        R = target[b]
        lo = b - cw
        hi = b + cw
        lo_c = max(0, lo)
        hi_c = min(n_samples, hi)
        if hi_c <= lo_c:
            continue
        idx = np.arange(lo_c, hi_c)
        x = (idx - lo) / (2.0 * cw)
        x = np.clip(x, 0.0, 1.0)
        vals = L + (R - L) * 0.5 * (1.0 - np.cos(np.pi * x))
        envelope[idx] = vals

    return envelope


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Transient detection & envelope shaper (attack/sustain rescaler)."
    )
    parser.add_argument("--input", required=True, help="Path to input WAV file.")
    parser.add_argument("--output", required=True, help="Path to write shaped WAV file.")
    parser.add_argument("--report", required=True, help="Path to write JSON report.")
    parser.add_argument(
        "--attack-gain-db", type=float, required=True, help="Gain (dB) for attack regions."
    )
    parser.add_argument(
        "--sustain-gain-db", type=float, required=True, help="Gain (dB) for sustain regions."
    )
    parser.add_argument(
        "--attack-ms", type=float, required=True, help="Attack region length in ms."
    )
    parser.add_argument(
        "--crossfade-ms",
        type=float,
        required=True,
        help="Per-side crossfade width (ms) at each region boundary.",
    )
    args = parser.parse_args()

    # --- Read input -------------------------------------------------
    audio, sr = sf.read(args.input, dtype="float64", always_2d=False)
    if audio.ndim > 1:
        # Defensive: collapse to mono if a stereo file is ever passed in.
        audio = np.mean(audio, axis=1)
    n_samples = len(audio)

    # --- Detect transients -------------------------------------------
    onset_samples = detect_transients(audio.astype(np.float32), sr)

    # --- Build gain envelope ------------------------------------------
    attack_lin = db_to_linear(args.attack_gain_db)
    sustain_lin = db_to_linear(args.sustain_gain_db)
    envelope = build_gain_envelope(
        n_samples=n_samples,
        sr=sr,
        onset_samples=onset_samples,
        attack_lin=attack_lin,
        sustain_lin=sustain_lin,
        attack_ms=args.attack_ms,
        crossfade_ms=args.crossfade_ms,
    )

    # --- Apply envelope -------------------------------------------------
    shaped = audio * envelope
    shaped = np.clip(shaped, -1.0, 1.0)

    # --- Write shaped audio (same length & sample rate as input) --------
    sf.write(args.output, shaped.astype(np.float32), sr, subtype="FLOAT")

    # --- Write JSON report -----------------------------------------------
    onsets_report = [
        {
            "onset_time": float(s) / float(sr),
            "attack_gain_db": args.attack_gain_db,
            "sustain_gain_db": args.sustain_gain_db,
        }
        for s in onset_samples.tolist()
    ]
    report = {
        "sample_rate": int(sr),
        "num_transients": len(onsets_report),
        "attack_gain_db": args.attack_gain_db,
        "sustain_gain_db": args.sustain_gain_db,
        "onsets": onsets_report,
    }
    with open(args.report, "w") as f:
        json.dump(report, f, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())
