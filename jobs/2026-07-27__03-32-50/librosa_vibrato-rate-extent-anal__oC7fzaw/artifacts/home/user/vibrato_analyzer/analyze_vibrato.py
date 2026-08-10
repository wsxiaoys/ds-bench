#!/usr/bin/env python3
"""
Vibrato Rate & Extent Analyzer
==============================

Loads a monophonic WAV recording, estimates its time-varying fundamental
frequency (F0) contour together with a per-frame voicing decision, segments
the recording into sustained note segments (maximal contiguous voiced
regions), and for each segment measures the vibrato rate (Hz) and extent
(peak-to-peak cents) of the pitch oscillation after removing the slow pitch
drift/glide. Each segment is classified as carrying vibrato or not.

Usage:
    python3 analyze_vibrato.py --input <input_wav_path> --output <output_json_path>
"""

import argparse
import json
import sys

import numpy as np
import librosa


# ----------------------------------------------------------------------
# Configuration constants
# ----------------------------------------------------------------------

# F0 tracking range (covers most sung / played melodic material).
F0_MIN_HZ = librosa.note_to_hz("C2")   # ~65.4 Hz
F0_MAX_HZ = librosa.note_to_hz("C6")   # ~1046.5 Hz


# A shorter analysis frame keeps the pitch tracker's internal averaging
# window well below one vibrato period (a period is ~111 ms at 9 Hz), so
# the measured F0 contour does not attenuate the true modulation depth.
# The frame length is specified as a *duration* (seconds) rather than a
# fixed sample count, and the actual frame_length/hop_length (in samples)
# are derived from the file's own sample rate at analysis time -- this
# keeps the effective F0 frame rate (and hence vibrato measurement
# fidelity) consistent regardless of the input file's sample rate.
FRAME_DURATION_SEC = 0.046   # ~46 ms analysis window
HOP_RATIO = 4                # hop_length = frame_length / HOP_RATIO

# Detrending (slow drift / glide removal) parameters.
# The slow pitch drift/glide within a sustained note is modelled as a
# low-order polynomial in time. A low-degree polynomial has essentially no
# capacity to represent a 4-9 Hz oscillation, so subtracting it isolates the
# vibrato oscillation without the arbitrary passband trade-offs of a
# windowed smoother / IIR filter.
TREND_MAX_DEGREE = 2

# Minimum number of voiced frames required to attempt vibrato analysis.
MIN_FRAMES_FOR_ANALYSIS = 4

# F0 estimates right at the onset/offset of a voiced region (attack/release
# transients) are often unreliable, since the pitch tracker is still locking
# on / losing track as energy ramps up or down. These edge frames are
# excluded from the vibrato feature extraction (but not from the reported
# segment start_time / end_time, which still reflect the full voiced
# region).
EDGE_TRIM_SEC = 0.05

# Frequency search band (Hz) when looking for the dominant modulation
# frequency of the detrended pitch oscillation.
RATE_SEARCH_MIN_HZ = 1.0
RATE_SEARCH_MAX_HZ = 15.0

# Classification thresholds.
VIBRATO_RATE_MIN_HZ = 4.0
VIBRATO_RATE_MAX_HZ = 9.0
VIBRATO_EXTENT_MIN_CENTS = 20.0


# ----------------------------------------------------------------------
# Helper functions
# ----------------------------------------------------------------------

def find_voiced_segments(voiced_flag):
    """Return a list of (start_idx, end_idx) inclusive index pairs for each
    maximal contiguous run of True values in voiced_flag."""
    segments = []
    n = len(voiced_flag)
    i = 0
    while i < n:
        if voiced_flag[i]:
            j = i
            while j < n and voiced_flag[j]:
                j += 1
            segments.append((i, j - 1))
            i = j
        else:
            i += 1
    return segments


def interpolate_nans(values):
    """Linearly interpolate any NaNs in a 1-D array (in place safe copy)."""
    values = np.asarray(values, dtype=float).copy()
    nans = np.isnan(values)
    if not np.any(nans):
        return values
    if np.all(nans):
        return values
    idx = np.arange(len(values))
    values[nans] = np.interp(idx[nans], idx[~nans], values[~nans])
    return values


def detrend_pitch_cents(cents, frame_rate):
    """Remove the slow pitch drift/glide from a cents contour, returning the
    residual oscillation (the vibrato signal).

    The drift/glide is modelled as a low-order polynomial in time and
    subtracted off. A low-degree polynomial cannot represent a 4-9 Hz
    oscillation, so this isolates the vibrato without attenuating it the way
    a windowed smoother or a Butterworth high-pass filter (whose passband
    edge would necessarily sit close to the 4 Hz vibrato boundary) would.
    """
    n = len(cents)
    t = np.arange(n, dtype=float) / frame_rate

    if n >= 6:
        degree = TREND_MAX_DEGREE
    elif n >= 3:
        degree = 1
    else:
        degree = 0

    if degree == 0:
        trend = np.full(n, np.mean(cents))
    else:
        coeffs = np.polyfit(t, cents, degree)
        trend = np.polyval(coeffs, t)

    residual = cents - trend
    return residual


def dominant_frequency(signal, frame_rate):
    """Estimate the dominant modulation frequency (Hz) of a real-valued,
    (roughly) zero-mean 1-D signal sampled at frame_rate, searching within
    the [RATE_SEARCH_MIN_HZ, RATE_SEARCH_MAX_HZ] band."""
    m = len(signal)
    if m < 2:
        return None

    window = np.hanning(m) if m > 1 else np.ones(m)
    windowed = signal * window

    nfft = max(1024, 1 << int(np.ceil(np.log2(max(m, 2)))))
    nfft *= 4  # zero-pad generously for finer frequency resolution

    spectrum = np.abs(np.fft.rfft(windowed, n=nfft))
    freqs = np.fft.rfftfreq(nfft, d=1.0 / frame_rate)

    band_mask = (freqs >= RATE_SEARCH_MIN_HZ) & (freqs <= RATE_SEARCH_MAX_HZ)
    if not np.any(band_mask):
        return None

    band_spectrum = spectrum[band_mask]
    band_freqs = freqs[band_mask]
    peak_idx = int(np.argmax(band_spectrum))
    return float(band_freqs[peak_idx])


def analyze_segment(f0_segment, frame_rate):
    """Given the F0 values (Hz) of one voiced note segment, compute the
    vibrato rate (Hz) and peak-to-peak extent (cents) of its detrended pitch
    oscillation. Returns (rate_hz_or_None, extent_cents_or_None)."""
    n = len(f0_segment)
    if n < MIN_FRAMES_FOR_ANALYSIS:
        return None, None

    f0_segment = interpolate_nans(f0_segment)
    if np.any(np.isnan(f0_segment)) or np.any(f0_segment <= 0):
        return None, None

    # Discard unreliable onset/offset transient frames before analysis.
    edge_trim = int(round(EDGE_TRIM_SEC * frame_rate))
    if edge_trim > 0 and n - 2 * edge_trim >= MIN_FRAMES_FOR_ANALYSIS:
        f0_segment = f0_segment[edge_trim:n - edge_trim]
        n = len(f0_segment)

    ref = np.median(f0_segment)
    if ref <= 0:
        return None, None

    cents = 1200.0 * np.log2(f0_segment / ref)

    residual = detrend_pitch_cents(cents, frame_rate)

    if len(residual) < 2:
        return None, None

    extent = float(np.max(residual) - np.min(residual))
    rate = dominant_frequency(residual, frame_rate)

    return rate, extent


def classify(rate, extent):
    if rate is None or extent is None:
        return False
    return (
        VIBRATO_RATE_MIN_HZ <= rate <= VIBRATO_RATE_MAX_HZ
        and extent >= VIBRATO_EXTENT_MIN_CENTS
    )


# ----------------------------------------------------------------------
# Main analysis pipeline
# ----------------------------------------------------------------------

def analyze_file(input_path):
    y, sr = librosa.load(input_path, sr=None, mono=True)

    # Derive frame_length/hop_length (in samples) from the file's actual
    # sample rate so that the effective F0 frame rate is consistent across
    # inputs, and large enough that at least ~2 periods of F0_MIN_HZ fit in
    # one analysis frame (pyin's own accuracy requirement).
    frame_length = int(round(FRAME_DURATION_SEC * sr))
    min_frame_length = int(np.ceil(2.5 * sr / F0_MIN_HZ))
    frame_length = max(frame_length, min_frame_length)
    frame_length = max(frame_length, HOP_RATIO * 4)

    # Guard against frame lengths that exceed the whole signal (very short
    # inputs) -- fall back to something that still fits.
    if frame_length > len(y):
        frame_length = max(HOP_RATIO * 4, 1 << int(np.floor(np.log2(max(len(y), 2)))))

    hop_length = max(1, frame_length // HOP_RATIO)

    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=F0_MIN_HZ,
        fmax=F0_MAX_HZ,
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length,
    )

    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)
    frame_rate = sr / hop_length
    frame_duration = hop_length / sr

    voiced_flag = np.asarray(voiced_flag, dtype=bool)
    # Frames where pyin could not decide voicing but produced NaN f0 should
    # not be treated as voiced.
    voiced_flag = voiced_flag & ~np.isnan(f0)

    segments = find_voiced_segments(voiced_flag)

    results = []
    for start_idx, end_idx in segments:
        start_time = float(times[start_idx])
        end_time = float(times[end_idx] + frame_duration)

        f0_segment = f0[start_idx:end_idx + 1]
        rate, extent = analyze_segment(f0_segment, frame_rate)
        has_vibrato = classify(rate, extent)

        if not has_vibrato:
            rate = None
            extent = None

        results.append({
            "start_time": start_time,
            "end_time": end_time,
            "has_vibrato": bool(has_vibrato),
            "vibrato_rate_hz": rate,
            "vibrato_extent_cents": extent,
        })

    results.sort(key=lambda r: r["start_time"])
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Analyze vibrato rate and extent of sustained notes in a monophonic WAV recording."
    )
    parser.add_argument("--input", required=True, help="Path to the input mono WAV file.")
    parser.add_argument("--output", required=True, help="Path to write the output JSON file.")
    args = parser.parse_args()

    results = analyze_file(args.input)

    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())
