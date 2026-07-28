#!/usr/bin/env python3
import os
import sys
import argparse
import json
import numpy as np
import librosa
import scipy.signal

def analyze_segment(f0_segment, fs_pitch):
    """
    Analyze a single pitch segment (in Hz) to compute vibrato rate and extent.
    
    Parameters:
    - f0_segment: 1D numpy array of F0 values in Hz
    - fs_pitch: sampling rate of the pitch contour (frames per second)
    
    Returns:
    - has_vibrato: bool
    - vibrato_rate_hz: float or None
    - vibrato_extent_cents: float or None
    """
    n_samples = len(f0_segment)
    # We need a minimum number of samples to robustly filter and analyze vibrato
    if n_samples < 15:
        return False, None, None

    # Convert Hz to cents
    # Use 1.0 Hz as reference so pitch_cents is absolute cents
    pitch_cents = 1200 * np.log2(f0_segment)

    # Detrend using a linear detrend first to remove linear drift
    pitch_detrended_linear = scipy.signal.detrend(pitch_cents)

    # Design a 2nd-order high-pass Butterworth filter to remove slow non-linear drift
    # We use a cutoff of 2.0 Hz to preserve the 4-9 Hz vibrato range
    nyq = fs_pitch / 2.0
    cutoff = 2.0

    if cutoff >= nyq:
        # If the pitch sampling rate is too low to filter at 2.0 Hz,
        # we fall back to the linear detrended signal
        p_vibrato = pitch_detrended_linear
    else:
        b, a = scipy.signal.butter(2, cutoff / nyq, btype='high')
        try:
            p_vibrato = scipy.signal.filtfilt(b, a, pitch_detrended_linear)
        except Exception:
            p_vibrato = pitch_detrended_linear

    # To avoid filter boundary transients affecting the peak-to-peak extent,
    # we trim 10% of the frames from each end (up to a maximum of 5 frames)
    trim = min(5, int(len(p_vibrato) * 0.1))
    if trim > 0 and len(p_vibrato) > 2 * trim:
        trimmed_p = p_vibrato[trim:-trim]
    else:
        trimmed_p = p_vibrato

    # Compute peak-to-peak extent (in cents) on the trimmed signal
    extent = np.max(trimmed_p) - np.min(trimmed_p)

    # Compute FFT to find the dominant modulation frequency
    # Zero-pad to 8192 points for high frequency resolution
    N = 8192
    fft_vals = np.fft.rfft(p_vibrato, n=N)
    fft_freqs = np.fft.rfftfreq(N, d=1.0/fs_pitch)

    # Search for the dominant frequency in the range [2.0, 15.0] Hz
    valid_idx = np.where((fft_freqs >= 2.0) & (fft_freqs <= min(15.0, nyq)))[0]
    if len(valid_idx) == 0:
        peak_freq = 0.0
    else:
        peak_idx = valid_idx[np.argmax(np.abs(fft_vals[valid_idx]))]
        peak_freq = fft_freqs[peak_idx]

    # Classification rule:
    # dominant modulation frequency between 4 Hz and 9 Hz AND peak-to-peak extent of at least 20 cents
    has_vibrato = (4.0 <= peak_freq <= 9.0) and (extent >= 20.0)

    if has_vibrato:
        return True, float(peak_freq), float(extent)
    else:
        return False, None, None

def main():
    parser = argparse.ArgumentParser(description="Vibrato Rate & Extent Analyzer")
    parser.add_argument("--input", required=True, help="Path to the input mono WAV file")
    parser.add_argument("--output", required=True, help="Path to write the output JSON file")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' does not exist.", file=sys.stderr)
        sys.exit(1)

    try:
        # Load the WAV file using its native sampling rate
        y, sr = librosa.load(args.input, sr=None, mono=True)
    except Exception as e:
        print(f"Error loading audio file: {e}", file=sys.stderr)
        sys.exit(1)

    # Define hop length and frame length
    frame_length = 2048
    hop_length = 512

    # Run pYIN to estimate F0 and get voicing decisions
    # We use a broad range C2 (65.4 Hz) to C7 (2093 Hz) to cover most singing/instrumental pitches
    fmin = 55.0
    fmax = 2000.0

    try:
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=fmin,
            fmax=fmax,
            sr=sr,
            frame_length=frame_length,
            hop_length=hop_length
        )
    except Exception as e:
        print(f"Error estimating F0: {e}", file=sys.stderr)
        sys.exit(1)

    # Pitch sampling rate
    fs_pitch = sr / hop_length

    # Find contiguous voiced regions (segments)
    voiced_indices = np.where(voiced_flag)[0]
    segments_results = []

    if len(voiced_indices) > 0:
        # Find gaps where the difference between consecutive voiced indices is > 1
        gaps = np.where(np.diff(voiced_indices) > 1)[0]
        start_indices = [voiced_indices[0]]
        end_indices = []
        for g in gaps:
            end_indices.append(voiced_indices[g])
            start_indices.append(voiced_indices[g + 1])
        end_indices.append(voiced_indices[-1])

        for start_idx, end_idx in zip(start_indices, end_indices):
            # Calculate segment start and end times in seconds
            start_time = float(start_idx * hop_length / sr)
            end_time = float((end_idx + 1) * hop_length / sr)

            # Isolate F0 contour for this segment
            f0_segment = f0[start_idx : end_idx + 1]
            # Remove any NaNs or non-positive values
            f0_segment_clean = f0_segment[~np.isnan(f0_segment) & (f0_segment > 0)]

            has_vibrato, rate, extent = analyze_segment(f0_segment_clean, fs_pitch)

            segments_results.append({
                "start_time": round(start_time, 4),
                "end_time": round(end_time, 4),
                "has_vibrato": has_vibrato,
                "vibrato_rate_hz": round(rate, 4) if rate is not None else None,
                "vibrato_extent_cents": round(extent, 4) if extent is not None else None
            })

    # Sort segments by ascending start_time
    segments_results.sort(key=lambda x: x["start_time"])

    # Write the results to the JSON file
    try:
        with open(args.output, "w") as f:
            json.dump(segments_results, f, indent=2)
    except Exception as e:
        print(f"Error writing output JSON file: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Successfully analyzed {len(segments_results)} segments.")
    sys.exit(0)

if __name__ == "__main__":
    main()
