#!/usr/bin/env python3
"""
Transient-preserving phase-vocoder time-stretch and pitch-shift.

Given a mono WAV file, produces:
  1. stretched.wav  - time-stretched by a fixed factor (pitch unchanged)
  2. shifted.wav    - pitch-shifted by a fixed number of semitones (duration unchanged)
  3. analysis.json  - measured durations and detected transient locations

The core idea: standard phase-vocoder time-scale modification smears
transient (broadband, percussive) events because the running phase
accumulator loses coherence across an attack. To avoid this we:

  1. Detect transient (onset) events in the input using a spectral-flux
     onset-strength envelope (STFT hop = 512 samples).
  2. Split the signal into an alternating sequence of "transient" blocks
     (a short window around each detected onset) and "stationary" blocks
     (the tonal/steady material between onsets).
  3. Stationary blocks are processed with a classic STFT phase vocoder
     (correct phase propagation) to perform the time-stretch / pitch-shift.
  4. Transient blocks are copied verbatim from the input (sample-accurate),
     which exactly preserves their sharpness. Their placement in the
     output timeline is computed so that the onset instant lands exactly
     at its expected scaled position (stretch case) or at its original
     position (pitch-shift case, since overall duration is unchanged).
  5. All blocks are concatenated with very short (a few ms) edge tapers
     to avoid clicks at the block boundaries, without altering timing.
"""

import argparse
import json
import os
import sys

import numpy as np
import librosa
import soundfile as sf

# ----------------------------------------------------------------------------
# Fixed parameters (per task spec)
# ----------------------------------------------------------------------------
STRETCH_FACTOR = 1.5
PITCH_SHIFT_SEMITONES = 7.0
HOP_LENGTH = 512          # required hop length for transient/STFT analysis
N_FFT = 2048

# Transient window around each detected onset that is copied verbatim
# (kept short so it has negligible effect on overall target durations).
TRANS_PRE_MS = 5.0
TRANS_POST_MS = 45.0

# Edge taper applied at block boundaries to avoid clicks (does not change
# block length or the position of any sample).
FADE_MS = 3.0

# Minimum block length (in samples) required to run a meaningful STFT-based
# phase vocoder; shorter blocks fall back to a plain bandlimited resample.
MIN_PV_LEN = N_FFT + HOP_LENGTH


# ----------------------------------------------------------------------------
# Transient detection
# ----------------------------------------------------------------------------
def detect_transients(y, sr, hop_length=HOP_LENGTH):
    """Detect broadband onset (transient) events.

    Returns (frames, samples) both sorted ascending, one entry per genuine
    onset event (not a flood of spurious detections).
    """
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_frames = librosa.onset.onset_detect(
        onset_envelope=onset_env,
        sr=sr,
        hop_length=hop_length,
        backtrack=True,
        units="frames",
    )
    onset_frames = np.sort(np.unique(onset_frames)).astype(int)
    onset_samples = (onset_frames.astype(np.int64) * hop_length).astype(int)
    return onset_frames, onset_samples


def compute_transient_windows(y, onset_samples, sr, n_samples):
    """Build merged, non-overlapping [start, end, anchor] windows around
    each onset sample.

    `anchor` is the sample of maximum absolute amplitude within the window
    (a precise, phase-accurate reference point for the transient event),
    used only to align the transient's temporal position in the rendered
    output. The reported `transient_frames`/`transient_times_seconds` in
    the analysis are derived separately from the onset-detector frames.
    """
    pre = int(round(TRANS_PRE_MS / 1000.0 * sr))
    post = int(round(TRANS_POST_MS / 1000.0 * sr))

    windows = []
    for onset in onset_samples:
        start = max(0, int(onset) - pre)
        end = min(n_samples, int(onset) + post)
        if end <= start:
            continue
        local = y[start:end]
        anchor = start + int(np.argmax(np.abs(local))) if len(local) > 0 else int(onset)
        windows.append([start, end, anchor])

    windows.sort(key=lambda w: w[0])
    merged = []
    for w in windows:
        if merged and w[0] <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], w[1])
            # keep the earliest window's anchor as representative
        else:
            merged.append(w)
    return merged


# ----------------------------------------------------------------------------
# Core STFT phase-vocoder building block
# ----------------------------------------------------------------------------
def _fallback_resample(seg, target_len):
    """Plain bandlimited resample used only for blocks too short for a
    meaningful STFT phase vocoder (e.g. a leading/trailing sliver)."""
    n = len(seg)
    if n == 0 or target_len <= 0:
        return np.zeros(max(target_len, 0), dtype=np.float32)
    y_rs = librosa.resample(
        np.asarray(seg, dtype=np.float32), orig_sr=n, target_sr=max(target_len, 1),
        res_type="soxr_hq",
    )
    return librosa.util.fix_length(y_rs, size=target_len)


def phase_vocoder_stretch(seg, target_len):
    """Time-stretch `seg` to exactly `target_len` samples using an STFT
    phase vocoder with correct phase propagation (librosa.phase_vocoder),
    preserving pitch."""
    n = len(seg)
    if target_len <= 0:
        return np.zeros(0, dtype=np.float32)
    if n == 0:
        return np.zeros(target_len, dtype=np.float32)

    if n < MIN_PV_LEN or target_len < MIN_PV_LEN:
        return _fallback_resample(seg, target_len)

    rate = n / float(target_len)
    n_fft = N_FFT
    if n_fft > n:
        n_fft = int(2 ** np.floor(np.log2(max(n // 2, 64))))
    D = librosa.stft(np.asarray(seg, dtype=np.float32), n_fft=n_fft,
                      hop_length=HOP_LENGTH, window="hann")
    D_stretch = librosa.phase_vocoder(D, rate=rate, hop_length=HOP_LENGTH)
    y_stretch = librosa.istft(D_stretch, hop_length=HOP_LENGTH, window="hann",
                               length=target_len)
    return librosa.util.fix_length(y_stretch, size=target_len)


def phase_vocoder_pitch_shift(seg, sr, n_steps, target_len):
    """Pitch-shift `seg` by `n_steps` semitones, forcing the output to be
    exactly `target_len` samples (duration-preserving pitch shift), using
    the classic time-stretch + resample technique built on top of the
    phase vocoder above."""
    n = len(seg)
    if n == 0 or target_len <= 0:
        return np.zeros(max(target_len, 0), dtype=np.float32)

    rate = 2.0 ** (-float(n_steps) / 12.0)
    intermediate_len = max(int(round(n / rate)), 1)
    stretched = phase_vocoder_stretch(seg, intermediate_len)
    resampled = librosa.resample(
        np.asarray(stretched, dtype=np.float32),
        orig_sr=max(len(stretched), 1),
        target_sr=max(target_len, 1),
        res_type="soxr_hq",
    )
    return librosa.util.fix_length(resampled, size=target_len)


# ----------------------------------------------------------------------------
# Block segmentation + rendering
# ----------------------------------------------------------------------------
def build_pieces(n_samples, transient_windows):
    """Alternating list of stationary / transient pieces covering
    [0, n_samples)."""
    pieces = []
    prev_end = 0
    for (start, end, anchor) in transient_windows:
        if start > prev_end:
            pieces.append({"kind": "stat", "start": prev_end, "end": start})
        pieces.append({"kind": "trans", "start": start, "end": end, "anchor": anchor})
        prev_end = end
    if prev_end < n_samples:
        pieces.append({"kind": "stat", "start": prev_end, "end": n_samples})
    return pieces


def _apply_edge_fades(chunks, sr):
    fade_len_max = int(round(FADE_MS / 1000.0 * sr))
    if fade_len_max <= 0 or len(chunks) < 2:
        return chunks
    for i in range(len(chunks)):
        c = chunks[i]
        n = len(c)
        if n == 0:
            continue
        fl = min(fade_len_max, n // 2)
        if fl <= 1:
            continue
        if i > 0:
            ramp = np.linspace(0.0, 1.0, fl, dtype=np.float32)
            c[:fl] = c[:fl] * ramp
        if i < len(chunks) - 1:
            ramp = np.linspace(1.0, 0.0, fl, dtype=np.float32)
            c[-fl:] = c[-fl:] * ramp
        chunks[i] = c
    return chunks


def render_stretch(y, sr, pieces, stretch_factor):
    n_samples = len(y)
    total_target = int(round(n_samples * stretch_factor))

    out_chunks = []
    cumulative_out = 0
    for idx, piece in enumerate(pieces):
        if piece["kind"] == "trans":
            seg = np.array(y[piece["start"]:piece["end"]], dtype=np.float32, copy=True)
            out_chunks.append(seg)
            cumulative_out += len(seg)
        else:
            seg = y[piece["start"]:piece["end"]]
            nxt = pieces[idx + 1] if idx + 1 < len(pieces) else None
            if nxt is not None and nxt["kind"] == "trans":
                anchor = nxt["anchor"]
                off = anchor - nxt["start"]
                anchor_target = int(round(anchor * stretch_factor))
                out_start_next = anchor_target - off
                target_len = out_start_next - cumulative_out
            else:
                target_len = total_target - cumulative_out
            target_len = max(target_len, 0)
            processed = phase_vocoder_stretch(seg, target_len)
            out_chunks.append(processed)
            cumulative_out += len(processed)

    out_chunks = _apply_edge_fades(out_chunks, sr)
    y_out = np.concatenate(out_chunks) if out_chunks else np.zeros(0, dtype=np.float32)
    y_out = librosa.util.fix_length(y_out, size=total_target)
    return y_out


def render_shift(y, sr, pieces, n_steps):
    n_samples = len(y)
    total_target = n_samples  # duration must be unchanged

    out_chunks = []
    cumulative_out = 0
    for idx, piece in enumerate(pieces):
        if piece["kind"] == "trans":
            seg = np.array(y[piece["start"]:piece["end"]], dtype=np.float32, copy=True)
            out_chunks.append(seg)
            cumulative_out += len(seg)
        else:
            seg = y[piece["start"]:piece["end"]]
            nxt = pieces[idx + 1] if idx + 1 < len(pieces) else None
            if nxt is not None and nxt["kind"] == "trans":
                anchor = nxt["anchor"]
                off = anchor - nxt["start"]
                anchor_target = anchor  # position unchanged for pitch shift
                out_start_next = anchor_target - off
                target_len = out_start_next - cumulative_out
            else:
                target_len = total_target - cumulative_out
            target_len = max(target_len, 0)
            processed = phase_vocoder_pitch_shift(seg, sr, n_steps, target_len)
            out_chunks.append(processed)
            cumulative_out += len(processed)

    out_chunks = _apply_edge_fades(out_chunks, sr)
    y_out = np.concatenate(out_chunks) if out_chunks else np.zeros(0, dtype=np.float32)
    y_out = librosa.util.fix_length(y_out, size=total_target)
    return y_out


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to input mono WAV file")
    parser.add_argument("--output-dir", required=True, help="Directory to write outputs to")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    info = sf.info(args.input)
    subtype = info.subtype if info.subtype else "PCM_16"

    y, sr = sf.read(args.input, always_2d=False)
    y = np.asarray(y, dtype=np.float32)
    if y.ndim > 1:
        y = np.mean(y, axis=1).astype(np.float32)
    sr = int(sr)
    n_samples = len(y)
    input_duration = n_samples / float(sr)

    # --- Transient detection (on the original input) ---------------------
    onset_frames, onset_samples = detect_transients(y, sr, hop_length=HOP_LENGTH)
    transient_windows = compute_transient_windows(y, onset_samples, sr, n_samples)

    # --- Time stretch (1.5x, pitch unchanged) -----------------------------
    stretch_pieces = build_pieces(n_samples, transient_windows)
    y_stretched = render_stretch(y, sr, stretch_pieces, STRETCH_FACTOR)
    y_stretched = np.clip(y_stretched, -1.0, 1.0).astype(np.float32)

    # --- Pitch shift (+7 semitones, duration unchanged) -------------------
    shift_pieces = build_pieces(n_samples, transient_windows)
    y_shifted = render_shift(y, sr, shift_pieces, PITCH_SHIFT_SEMITONES)
    y_shifted = np.clip(y_shifted, -1.0, 1.0).astype(np.float32)

    stretched_path = os.path.join(args.output_dir, "stretched.wav")
    shifted_path = os.path.join(args.output_dir, "shifted.wav")
    analysis_path = os.path.join(args.output_dir, "analysis.json")

    sf.write(stretched_path, y_stretched, sr, subtype=subtype)
    sf.write(shifted_path, y_shifted, sr, subtype=subtype)

    stretched_duration = len(y_stretched) / float(sr)
    shifted_duration = len(y_shifted) / float(sr)

    analysis = {
        "sample_rate": sr,
        "stretch_factor": STRETCH_FACTOR,
        "pitch_shift_semitones": PITCH_SHIFT_SEMITONES,
        "input_duration_seconds": input_duration,
        "stretched_duration_seconds": stretched_duration,
        "shifted_duration_seconds": shifted_duration,
        "transient_frames": [int(f) for f in onset_frames],
        "transient_times_seconds": [float(f) * HOP_LENGTH / sr for f in onset_frames],
    }

    with open(analysis_path, "w") as f:
        json.dump(analysis, f, indent=2)

    print(f"Wrote {stretched_path} ({stretched_duration:.4f}s)")
    print(f"Wrote {shifted_path} ({shifted_duration:.4f}s)")
    print(f"Wrote {analysis_path}")


if __name__ == "__main__":
    sys.exit(main())
